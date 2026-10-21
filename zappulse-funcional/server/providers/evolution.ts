import { db, Chip, ConnState } from '../store';
import { Provider, QrResult, SendResult } from './types';

function cfg() {
  const { baseUrl, globalToken } = db.settings.evolution;
  return { baseUrl: (baseUrl || '').replace(/\/+$/, ''), token: globalToken };
}

class EvoError extends Error {
  constructor(msg: string, public status?: number, public body?: any, public network = false) {
    super(msg);
  }
}

async function evo(
  method: string,
  path: string,
  body?: any,
  timeoutMs = 15000,
  override?: { baseUrl: string; token: string }
): Promise<any> {
  const { baseUrl, token } = override ?? cfg();
  if (!baseUrl) throw new EvoError('Evolution API não configurada (URL vazia).', undefined, undefined, true);
  let res: Response;
  try {
    res = await fetch(baseUrl + path, {
      method,
      headers: { 'Content-Type': 'application/json', apikey: token },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e: any) {
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    throw new EvoError(
      timeout
        ? `Evolution API não respondeu em ${timeoutMs / 1000}s (servidor fora do ar?)`
        : `Evolution API inacessível: ${e?.cause?.code || e?.message}`,
      undefined,
      undefined,
      true
    );
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const detail = json?.response?.message ?? json?.message ?? text.slice(0, 200);
    const d = typeof detail === 'string' ? detail : JSON.stringify(detail);
    throw new EvoError(`Evolution API HTTP ${res.status}: ${d}`, res.status, json ?? text, res.status >= 502);
  }
  return json;
}

const mapState = (s: string | undefined): ConnState =>
  s === 'open' ? 'open' : s === 'connecting' ? 'connecting' : 'close';

const WEBHOOK_EVENTS = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'];

function webhookUrl(): string {
  const base = (db.settings.publicUrl || '').replace(/\/+$/, '');
  return base ? `${base}/api/webhook/evolution?token=${db.settings.webhookToken}` : '';
}

async function ensureInstance(chip: Chip) {
  const name = chip.instanceName;
  try {
    await evo('GET', `/instance/connectionState/${encodeURIComponent(name)}`);
    return;
  } catch (e: any) {
    if (e.status !== 404) throw e;
  }
  const hook = webhookUrl();
  await evo('POST', '/instance/create', {
    instanceName: name,
    integration: 'WHATSAPP-BAILEYS',
    qrcode: true,
    ...(chip.apiKey && !chip.apiKey.startsWith('evo_live_') ? { token: chip.apiKey } : {}),
  });
  if (hook) await setWebhook(name, hook).catch(() => {});
}

async function setWebhook(name: string, url: string) {
  const enc = encodeURIComponent(name);
  try {
    await evo('POST', `/webhook/set/${enc}`, {
      webhook: { enabled: true, url, byEvents: false, base64: false, events: WEBHOOK_EVENTS },
    });
  } catch (e: any) {
    if (e.status === 400) {
      await evo('POST', `/webhook/set/${enc}`, {
        enabled: true,
        url,
        webhookByEvents: false,
        webhookBase64: false,
        events: WEBHOOK_EVENTS,
      });
    } else throw e;
  }
}

export const evolutionProvider: Provider = {
  name: 'evolution',

  async getState(chip) {
    try {
      const r = await evo('GET', `/instance/connectionState/${encodeURIComponent(chip.instanceName)}`, undefined, 10000);
      const state = mapState(r?.instance?.state ?? r?.state);
      return { state };
    } catch (e: any) {
      if (e.status === 404) return { state: 'close', error: 'Instância não existe na Evolution (será criada ao gerar o QR).' };
      return { state: 'close', error: e.message };
    }
  },

  async getQr(chip): Promise<QrResult> {
    try {
      await ensureInstance(chip);
      const r = await evo('GET', `/instance/connect/${encodeURIComponent(chip.instanceName)}`);
      const base64 = r?.base64 ?? r?.qrcode?.base64;
      if (base64) {
        return {
          state: 'connecting',
          qr: String(base64).startsWith('data:') ? base64 : `data:image/png;base64,${base64}`,
          pairingCode: r?.pairingCode || undefined,
        };
      }
      const st = mapState(r?.instance?.state ?? r?.state);
      if (st === 'open') return { state: 'open' };
      return { state: 'connecting', error: 'A Evolution ainda não gerou o QR. Tente novamente em alguns segundos.' };
    } catch (e: any) {
      return { state: 'close', error: e.message };
    }
  },

  async sendText(chip, number, text, typingMs): Promise<SendResult> {
    const enc = encodeURIComponent(chip.instanceName);
    const delay = Math.max(0, Math.round(typingMs));
    const parse = (e: any): SendResult => {
      const blob = JSON.stringify(e?.body ?? '') + String(e?.message ?? '');
      if (/"exists"\s*:\s*false/.test(blob) || /not on whatsapp|não.*whatsapp/i.test(blob))
        return { ok: false, notOnWhatsapp: true, error: 'Número sem WhatsApp' };
      return {
        ok: false,
        error: e?.message || String(e),
        connectionError: Boolean(e?.network) || /connection closed|not connected|disconnected/i.test(blob),
      };
    };
    try {
      // Evolution v2
      const r = await evo('POST', `/message/sendText/${enc}`, { number, text, delay }, 30000);
      return { ok: true, messageId: r?.key?.id };
    } catch (e: any) {
      // Evolution v1 usa outro formato de payload
      if (e.status === 400 && /textMessage|text/i.test(JSON.stringify(e.body ?? ''))) {
        try {
          const r = await evo(
            'POST',
            `/message/sendText/${enc}`,
            { number, options: { delay, presence: 'composing' }, textMessage: { text } },
            30000
          );
          return { ok: true, messageId: r?.key?.id };
        } catch (e2: any) {
          return parse(e2);
        }
      }
      return parse(e);
    }
  },

  async applyProxy(chip) {
    const p = chip.proxy;
    if (!p) return { ok: true };
    try {
      await evo('POST', `/proxy/set/${encodeURIComponent(chip.instanceName)}`, {
        enabled: Boolean(p.enabled),
        host: p.host,
        port: String(p.port),
        protocol: p.protocol || 'http',
        username: p.username || undefined,
        password: p.password || undefined,
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },

  async logout(chip) {
    await evo('DELETE', `/instance/logout/${encodeURIComponent(chip.instanceName)}`).catch(() => {});
  },

  async remove(chip) {
    await evo('DELETE', `/instance/delete/${encodeURIComponent(chip.instanceName)}`).catch(() => {});
  },
};

export async function evolutionPing(baseUrl?: string, token?: string) {
  const c = cfg();
  const override = {
    baseUrl: (baseUrl ?? c.baseUrl).replace(/\/+$/, ''),
    token: token || c.token,
  };
  const start = Date.now();
  try {
    const r = await evo('GET', '/instance/fetchInstances', undefined, 8000, override);
    return { connected: true, latencyMs: Date.now() - start, instances: Array.isArray(r) ? r : [] };
  } catch (e: any) {
    return { connected: false, latencyMs: Date.now() - start, error: e.message as string, instances: [] as any[] };
  }
}

export async function evolutionFetchInstances(): Promise<any[]> {
  const r = await evo('GET', '/instance/fetchInstances', undefined, 15000);
  return Array.isArray(r) ? r : [];
}

export { setWebhook as evolutionSetWebhook, webhookUrl as evolutionWebhookUrl };
