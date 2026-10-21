/**
 * Conexão DIRETA com o WhatsApp Web via Baileys — não depende da Evolution API.
 * Cada chip = uma sessão multi-device guardada em data/baileys/<chipId>.
 */
import fs from 'fs';
import path from 'path';
import { Chip, ConnState, dataDir, db, save } from '../store';
import { brVariants, normalizePhone } from '../phone';
import { Provider, QrResult, SendResult, emitConn, emitInbound, sleep } from './types';

interface Session {
  sock: any;
  state: ConnState;
  qr?: string;
  owner?: string;
  starting: boolean;
  stopped: boolean;
  retries: number;
  lastError?: string;
}

const sessions = new Map<string, Session>();
let lib: any = null;

const silentLogger: any = {
  level: 'silent',
  child() {
    return silentLogger;
  },
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
  fatal() {},
};

async function loadLib() {
  if (lib) return lib;
  try {
    const m: any = await import('@whiskeysockets/baileys');
    lib = { ...(m.default && typeof m.default === 'object' ? m.default : {}), ...m };
    lib.makeWASocket = typeof m.default === 'function' ? m.default : m.makeWASocket ?? m.default?.makeWASocket ?? m.default?.default;
    return lib;
  } catch (e: any) {
    throw new Error(
      'Pacote @whiskeysockets/baileys não instalado. Rode "npm install" na pasta do projeto. (' + e.message + ')'
    );
  }
}

const authDir = (chipId: string) => path.join(dataDir, 'baileys', chipId);

async function proxyAgent(chip: Chip): Promise<any> {
  const p = chip.proxy;
  if (!p?.enabled || !p.host || !p.port) return undefined;
  const auth = p.username ? `${encodeURIComponent(p.username)}:${encodeURIComponent(p.password || '')}@` : '';
  const url = `${p.protocol || 'http'}://${auth}${p.host}:${p.port}`;
  try {
    if (String(p.protocol).startsWith('socks')) {
      const { SocksProxyAgent } = await import('socks-proxy-agent');
      return new SocksProxyAgent(url);
    }
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    return new HttpsProxyAgent(url);
  } catch (e: any) {
    throw new Error('Proxy configurado mas pacote de proxy ausente (npm install). ' + e.message);
  }
}

function extractText(msg: any): string {
  if (!msg) return '';
  const m = msg.ephemeralMessage?.message || msg.viewOnceMessage?.message || msg;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedDisplayText ||
    m.listResponseMessage?.title ||
    m.templateButtonReplyMessage?.selectedDisplayText ||
    (m.audioMessage ? '[áudio]' : '') ||
    (m.imageMessage ? '[imagem]' : '') ||
    (m.documentMessage ? '[documento]' : '') ||
    (m.stickerMessage ? '[figurinha]' : '') ||
    ''
  );
}

async function start(chip: Chip): Promise<Session> {
  let s = sessions.get(chip.id);
  if (s && (s.sock || s.starting) && !s.stopped) return s;
  if (!s) {
    s = { sock: null, state: 'close', starting: false, stopped: false, retries: 0 };
    sessions.set(chip.id, s);
  }
  s.stopped = false;
  s.starting = true;
  s.state = 'connecting';
  emitConn(chip.id, 'connecting');
  try {
    const B = await loadLib();
    fs.mkdirSync(authDir(chip.id), { recursive: true });
    const { state, saveCreds } = await B.useMultiFileAuthState(authDir(chip.id));
    let version: any;
    try {
      version = (await B.fetchLatestBaileysVersion()).version;
    } catch {}
    const agent = await proxyAgent(chip);
    const sock = B.makeWASocket({
      auth: B.makeCacheableSignalKeyStore ? { creds: state.creds, keys: B.makeCacheableSignalKeyStore(state.keys, silentLogger) } : state,
      ...(version ? { version } : {}),
      logger: silentLogger,
      printQRInTerminal: false,
      browser: B.Browsers?.ubuntu ? B.Browsers.ubuntu('Chrome') : ['ZapPulse', 'Chrome', '1.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      ...(agent ? { agent, fetchAgent: agent } : {}),
    });
    s.sock = sock;
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (u: any) => {
      const { connection, lastDisconnect, qr } = u;
      if (qr) {
        s!.qr = qr;
        s!.state = 'connecting';
        emitConn(chip.id, 'connecting');
      }
      if (connection === 'open') {
        s!.state = 'open';
        s!.qr = undefined;
        s!.retries = 0;
        s!.lastError = undefined;
        const owner = String(sock.user?.id || '').split(':')[0].split('@')[0];
        s!.owner = owner;
        emitConn(chip.id, 'open', { owner });
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === (B.DisconnectReason?.loggedOut ?? 401);
        s!.sock = null;
        s!.state = 'close';
        s!.qr = undefined;
        s!.lastError = lastDisconnect?.error?.message;
        if (loggedOut || code === 403) {
          s!.stopped = true;
          try {
            fs.rmSync(authDir(chip.id), { recursive: true, force: true });
          } catch {}
          emitConn(chip.id, 'close', {
            error: loggedOut
              ? 'Sessão encerrada pelo WhatsApp (logout). Leia o QR Code novamente.'
              : 'Conta restringida/banida pelo WhatsApp (403).',
          });
          return;
        }
        emitConn(chip.id, 'close', { error: s!.lastError });
        if (!s!.stopped) {
          s!.retries++;
          const wait = Math.min(60000, 2000 * 2 ** Math.min(s!.retries, 5));
          setTimeout(() => {
            const cur = db.chips.find((c) => c.id === chip.id);
            if (cur && !s!.stopped) start(cur).catch(() => {});
          }, wait);
        }
      }
    });

    sock.ev.on('messages.upsert', ({ messages, type }: any) => {
      if (type !== 'notify') return;
      for (const m of messages || []) {
        if (m.key?.fromMe) continue;
        let jid: string = m.key?.remoteJid || '';
        if (!jid || jid.endsWith('@g.us') || jid.includes('broadcast') || jid.endsWith('@newsletter')) continue;
        if (jid.endsWith('@lid')) jid = m.key?.senderPn || m.key?.remoteJidAlt || m.key?.participantPn || jid;
        const text = extractText(m.message);
        if (!text) continue;
        emitInbound({
          chipId: chip.id,
          from: jid.split('@')[0].split(':')[0].replace(/\D/g, ''),
          pushName: m.pushName,
          text,
          messageId: m.key?.id,
          ts: Number(m.messageTimestamp) * 1000 || Date.now(),
        });
      }
    });
  } catch (e: any) {
    s.state = 'close';
    s.sock = null;
    s.lastError = e.message;
    emitConn(chip.id, 'close', { error: e.message });
  } finally {
    s.starting = false;
  }
  return s;
}

export const baileysProvider: Provider = {
  name: 'baileys',

  async getState(chip) {
    const s = sessions.get(chip.id);
    if (!s) return { state: 'close' };
    return { state: s.state, ownerNumber: s.owner, error: s.state === 'close' ? s.lastError : undefined };
  },

  async getQr(chip, opts): Promise<QrResult> {
    const s = await start(chip);
    if (s.state === 'open') return { state: 'open' };
    // aguarda o QR (ou pairing code) aparecer
    const deadline = Date.now() + 15000;
    if (opts?.phone && s.sock && !s.sock.authState?.creds?.registered) {
      try {
        await sleep(1500);
        const code = await s.sock.requestPairingCode(normalizePhone(opts.phone));
        return { state: 'connecting', pairingCode: code };
      } catch (e: any) {
        return { state: 'connecting', error: 'Falha ao gerar código de pareamento: ' + e.message };
      }
    }
    const cur = () => s.state as ConnState;
    while (!s.qr && cur() !== 'open' && Date.now() < deadline) {
      if (cur() === 'close' && !s.starting && s.lastError && s.stopped) break;
      await sleep(400);
    }
    if (cur() === 'open') return { state: 'open' };
    if (!s.qr) return { state: cur(), error: s.lastError || 'QR Code ainda não gerado, tente novamente.' };
    try {
      const QR: any = await import('qrcode');
      const toDataURL = QR.toDataURL ?? QR.default?.toDataURL;
      return { state: 'connecting', qr: await toDataURL(s.qr, { margin: 1, width: 320 }) };
    } catch (e: any) {
      return { state: 'connecting', error: 'Pacote "qrcode" não instalado (npm install). ' + e.message };
    }
  },

  async sendText(chip, number, text, typingMs): Promise<SendResult> {
    const s = sessions.get(chip.id);
    if (!s || s.state !== 'open' || !s.sock) return { ok: false, connectionError: true, error: 'Chip desconectado' };
    try {
      let jid: string | null = null;
      for (const cand of brVariants(number)) {
        const r = await s.sock.onWhatsApp(cand);
        const hit = Array.isArray(r) ? r.find((x: any) => x?.exists) : null;
        if (hit) {
          jid = hit.jid;
          break;
        }
      }
      if (!jid) return { ok: false, notOnWhatsapp: true, error: 'Número sem WhatsApp' };
      try {
        await s.sock.presenceSubscribe(jid);
        await s.sock.sendPresenceUpdate('composing', jid);
        await sleep(typingMs);
        await s.sock.sendPresenceUpdate('paused', jid);
      } catch {}
      const r = await s.sock.sendMessage(jid, { text });
      return { ok: true, messageId: r?.key?.id };
    } catch (e: any) {
      const msg = String(e?.message || e);
      return { ok: false, error: msg, connectionError: /closed|not open|timed out|Connection/i.test(msg) };
    }
  },

  async applyProxy(chip) {
    // proxy é aplicado ao criar o socket: reinicia a sessão se existir
    const s = sessions.get(chip.id);
    if (s?.sock) {
      s.stopped = true;
      try {
        s.sock.end(undefined);
      } catch {}
      sessions.delete(chip.id);
      await sleep(500);
      start(chip).catch(() => {});
    }
    return { ok: true };
  },

  async logout(chip) {
    const s = sessions.get(chip.id);
    if (s) {
      s.stopped = true;
      try {
        await s.sock?.logout();
      } catch {
        try {
          s.sock?.end(undefined);
        } catch {}
      }
      sessions.delete(chip.id);
    }
    try {
      fs.rmSync(authDir(chip.id), { recursive: true, force: true });
    } catch {}
  },

  async remove(chip) {
    await this.logout!(chip);
  },

  async boot(chips) {
    for (const c of chips) {
      if (c.provider !== 'baileys') continue;
      if (!fs.existsSync(path.join(authDir(c.id), 'creds.json'))) continue;
      start(c).catch((e) => console.error('[baileys] boot', c.instanceName, e.message));
      await sleep(1500); // escalona para não abrir todas as sessões de uma vez
    }
    save();
  },
};
