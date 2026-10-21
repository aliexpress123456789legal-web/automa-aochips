import express, { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import https from 'https';
import { timingSafeEqual } from 'crypto';
import { checkDbStatus, setConnectionString, runMigrations, COMPLETE_DDL } from './src/db/postgres.ts';
import { Batch, Chip, Lead, Template, addLog, db, save, uid } from './server/store.ts';
import { formatE164, normalizePhone, phoneKey } from './server/phone.ts';
import { providerFor, emitInbound } from './server/providers/index.ts';
import { evolutionProvider } from './server/providers/evolution.ts';
import { baileysProvider } from './server/providers/baileys.ts';
import {
  evolutionFetchInstances,
  evolutionPing,
  evolutionSetWebhook,
  evolutionWebhookUrl,
} from './server/providers/evolution.ts';
import { engineState, inSendingWindow, replyToResponse, sentLastHour, startEngine, syncConnections, tick, warmingDays } from './server/engine.ts';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '25mb' }));

// ---------------------------------------------------------------- auth
// Defina PANEL_PASSWORD no .env para proteger o painel (usuário: admin).
// Os webhooks usam ?token=<webhookToken> e não passam por aqui.
function safeEq(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
app.use((req: Request, res: Response, next: NextFunction) => {
  const pass = process.env.PANEL_PASSWORD;
  if (!pass || req.path.startsWith('/api/webhook/')) return next();
  const h = req.headers.authorization || '';
  if (h.startsWith('Basic ')) {
    const [, p = ''] = Buffer.from(h.slice(6), 'base64').toString().split(/:(.*)/s);
    if (safeEq(p, pass)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="ZapPulse"').status(401).send('Autenticação necessária');
});

const wrap =
  (fn: (req: Request, res: Response) => Promise<any> | any) =>
  (req: Request, res: Response) =>
    Promise.resolve(fn(req, res)).catch((e: any) => {
      console.error('[api]', req.method, req.path, e);
      res.status(500).json({ error: e.message || String(e) });
    });

// ----------------------------------------------------------- serializers
function chipOut(c: Chip) {
  const cooling = Boolean(c.cooldownUntil && c.cooldownUntil > Date.now());
  const { warmDates, cooldownUntil, nextWarmAt, consecutiveFailures, createdAt, ...rest } = c;
  return {
    ...rest,
    msgsPerHour: sentLastHour(c.id),
    warmingDays: warmingDays(c),
    cooldownUntil: cooling ? cooldownUntil : undefined,
    connectionQuality: c.connection !== 'open' ? 'disconnected' : cooling || consecutiveFailures > 0 ? 'warning' : 'optimal',
  };
}

function batchOut(b: Batch) {
  const ls = db.leads.filter((l) => l.batchId === b.id);
  const sent = ls.filter((l) => l.status === 'sent' || l.status === 'replied').length;
  const { nextDispatchAt, ...rest } = b;
  return {
    ...rest,
    nextDispatchAt: nextDispatchAt ? new Date(nextDispatchAt).toISOString() : undefined,
    totalLeads: ls.length,
    sentCount: sent,
    deliveredCount: sent,
    repliedCount: ls.filter((l) => l.status === 'replied').length,
    failedCount: ls.filter((l) => l.status === 'failed').length,
    pendingCount: ls.filter((l) => l.status === 'pending').length,
    optOutCount: ls.filter((l) => l.status === 'opt_out').length,
  };
}

function telemetry() {
  const from = Date.now() - 24 * 3600_000;
  const tz = db.settings.window.timezone || 'America/Sao_Paulo';
  const hourOf = (ts: number) => {
    try {
      return parseInt(
        new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(new Date(ts)),
        10
      ) % 24;
    } catch {
      return new Date(ts).getHours();
    }
  };
  const arr = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, '0')}h`,
    sent: 0,
    replied: 0,
    failed: 0,
  }));
  for (const l of db.logs) {
    if (l.ts < from || l.kind === 'system' || l.kind === 'warming') continue;
    const h = hourOf(l.ts);
    if (l.ok) arr[h].sent++;
    else arr[h].failed++;
  }
  for (const r of db.responses) {
    const ts = new Date(r.receivedAt).getTime();
    if (ts >= from) arr[hourOf(ts)].replied++;
  }
  return arr;
}

function settingsOut() {
  const s = db.settings;
  return {
    ...s,
    evolution: {
      baseUrl: s.evolution.baseUrl,
      globalTokenMasked: s.evolution.globalToken ? `${s.evolution.globalToken.slice(0, 4)}••••••••` : '',
      configured: Boolean(s.evolution.baseUrl),
    },
    webhookUrl: evolutionWebhookUrl() || `(defina a URL pública do painel) /api/webhook/evolution?token=${s.webhookToken}`,
    panelProtected: Boolean(process.env.PANEL_PASSWORD),
  };
}

// ------------------------------------------------------------------ state
app.get(
  '/api/state',
  wrap((req, res) => {
    res.json({
      chips: db.chips.map(chipOut),
      batches: db.batches.map(batchOut),
      templates: db.templates,
      responses: db.responses.slice(0, 500),
      telemetry: telemetry(),
      settings: settingsOut(),
      engine: {
        running: engineState.running,
        inWindow: inSendingWindow(),
        lastTickAt: engineState.lastTickAt,
        reason: engineState.lastReason,
        recentLogs: db.logs.slice(-40).reverse(),
      },
    });
  })
);

// --------------------------------------------------------------- settings
app.put(
  '/api/settings',
  wrap((req, res) => {
    const b = req.body || {};
    const s = db.settings;
    if (['evolution', 'baileys', 'mock'].includes(b.defaultProvider)) s.defaultProvider = b.defaultProvider;
    if (typeof b.workerEnabled === 'boolean') s.workerEnabled = b.workerEnabled;
    if (b.window) {
      const w = b.window;
      if (typeof w.enabled === 'boolean') s.window.enabled = w.enabled;
      if (/^\d{1,2}:\d{2}$/.test(w.start || '')) s.window.start = w.start;
      if (/^\d{1,2}:\d{2}$/.test(w.end || '')) s.window.end = w.end;
      if (Array.isArray(w.days)) s.window.days = w.days.map(Number).filter((n: number) => n >= 0 && n <= 6);
      if (typeof w.timezone === 'string' && w.timezone) s.window.timezone = w.timezone;
    }
    if (Number.isFinite(Number(b.dailyLimitPerChip)) && Number(b.dailyLimitPerChip) > 0)
      s.dailyLimitPerChip = Number(b.dailyLimitPerChip);
    if (Array.isArray(b.optOutKeywords)) s.optOutKeywords = b.optOutKeywords.map(String).filter(Boolean);
    if (typeof b.publicUrl === 'string') s.publicUrl = b.publicUrl.trim().replace(/\/+$/, '');
    save();
    res.json(settingsOut());
  })
);

// ------------------------------------------------------------------ chips
function newChip(b: any): Chip {
  const id = uid();
  const provider = ['evolution', 'baileys', 'mock'].includes(b.provider) ? b.provider : db.settings.defaultProvider;
  const name = String(b.instanceName || b.name || 'chip-' + id.slice(0, 4))
    .trim()
    .replace(/[^\w.-]/g, '-');
  return {
    id,
    instanceName: name,
    phoneNumber: b.phoneNumber ? formatE164(b.phoneNumber) : '',
    apiKey: b.apiKey || '',
    status: ['active', 'warming', 'banned', 'paused'].includes(b.status) ? b.status : 'warming',
    trustScore: Number.isFinite(b.trustScore) ? b.trustScore : 50,
    maxMsgsPerHour: Number(b.maxMsgsPerHour) > 0 ? Number(b.maxMsgsPerHour) : 20,
    warmingTargetDays: Number(b.warmingTargetDays) > 0 ? Number(b.warmingTargetDays) : 21,
    totalSent: 0,
    totalFailed: 0,
    lastSyncAt: new Date().toISOString(),
    deviceInfo: provider === 'baileys' ? 'WhatsApp Web (direto)' : provider === 'evolution' ? 'Evolution API' : 'Modo teste',
    proxy: b.proxy,
    provider,
    connection: provider === 'mock' ? 'open' : 'close',
    consecutiveFailures: 0,
    warmDates: {},
    createdAt: new Date().toISOString(),
  };
}

app.post(
  '/api/chips',
  wrap((req, res) => {
    const c = newChip(req.body || {});
    if (db.chips.some((x) => x.instanceName === c.instanceName))
      return res.status(409).json({ error: `Já existe um chip chamado "${c.instanceName}".` });
    db.chips.unshift(c);
    save();
    res.json({ success: true, chip: chipOut(c) });
  })
);

app.put(
  '/api/chips/:id',
  wrap(async (req, res) => {
    const c = db.chips.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Chip não encontrado' });
    const b = req.body || {};
    if (['active', 'warming', 'banned', 'paused'].includes(b.status)) {
      c.status = b.status;
      if (b.status === 'banned') c.trustScore = Math.min(c.trustScore, 20);
      if (b.status === 'active') c.nextWarmAt = undefined;
    }
    if (Number(b.maxMsgsPerHour) > 0) c.maxMsgsPerHour = Number(b.maxMsgsPerHour);
    if (typeof b.phoneNumber === 'string') c.phoneNumber = b.phoneNumber ? formatE164(b.phoneNumber) : '';
    if (b.proxy) {
      c.proxy = b.proxy;
      save();
      const r = await providerFor(c).applyProxy?.(c);
      return res.json({ success: true, proxyApplied: r?.ok ?? true, proxyError: r?.error });
    }
    save();
    res.json({ success: true });
  })
);

app.delete(
  '/api/chips/:id',
  wrap(async (req, res) => {
    const c = db.chips.find((x) => x.id === req.params.id);
    if (c) {
      await providerFor(c).remove?.(c);
      db.chips = db.chips.filter((x) => x.id !== c.id);
      db.batches.forEach((b) => (b.assignedChipIds = b.assignedChipIds.filter((i) => i !== c.id)));
      save();
    }
    res.json({ success: true });
  })
);

app.get(
  '/api/chips/:id/qr',
  wrap(async (req, res) => {
    const c = db.chips.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Chip não encontrado' });
    const r = await providerFor(c).getQr(c, { phone: req.query.phone as string | undefined });
    if (r.state === 'open') {
      c.connection = 'open';
      c.connectionError = undefined;
      save();
    }
    res.json(r);
  })
);

app.post(
  '/api/chips/:id/test',
  wrap(async (req, res) => {
    const c = db.chips.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Chip não encontrado' });
    const t0 = Date.now();
    const st = await providerFor(c).getState(c);
    c.connection = st.state;
    c.connectionError = st.state === 'open' ? undefined : st.error;
    if (st.state === 'open') c.lastSyncAt = new Date().toISOString();
    if (st.ownerNumber && !c.phoneNumber) c.phoneNumber = formatE164(st.ownerNumber);
    save();
    res.json({ state: st.state, error: st.error, latencyMs: Date.now() - t0 });
  })
);

app.post(
  '/api/chips/:id/logout',
  wrap(async (req, res) => {
    const c = db.chips.find((x) => x.id === req.params.id);
    if (!c) return res.status(404).json({ error: 'Chip não encontrado' });
    await providerFor(c).logout?.(c);
    c.connection = 'close';
    save();
    res.json({ success: true });
  })
);

app.post(
  '/api/chips/:id/send-test',
  wrap(async (req, res) => {
    const c = db.chips.find((x) => x.id === req.params.id);
    const { number, text } = req.body || {};
    if (!c || !number || !text) return res.status(400).json({ error: 'chip, number e text são obrigatórios' });
    const r = await providerFor(c).sendText(c, normalizePhone(number), String(text), 1500);
    if (r.ok) addLog({ kind: 'reply', ok: true, chipId: c.id, message: `teste → ${number}: ${text}` });
    res.json(r);
  })
);

// Teste REAL de proxy: abre uma conexão HTTPS por ele e descobre o IP de saída.
app.post(
  '/api/proxy/test',
  wrap(async (req, res) => {
    const p = req.body || {};
    if (!p.host || !p.port) return res.status(400).json({ error: 'host e port são obrigatórios' });
    const auth = p.username ? `${encodeURIComponent(p.username)}:${encodeURIComponent(p.password || '')}@` : '';
    const url = `${p.protocol || 'http'}://${auth}${p.host}:${p.port}`;
    let agent: any;
    try {
      if (String(p.protocol).startsWith('socks')) {
        const { SocksProxyAgent } = await import('socks-proxy-agent');
        agent = new SocksProxyAgent(url);
      } else {
        const { HttpsProxyAgent } = await import('https-proxy-agent');
        agent = new HttpsProxyAgent(url);
      }
    } catch (e: any) {
      return res.json({ ok: false, error: 'Pacotes de proxy ausentes (rode npm install): ' + e.message });
    }
    const t0 = Date.now();
    const out = await new Promise<{ ok: boolean; ip?: string; error?: string }>((resolve) => {
      const r = https.get('https://api.ipify.org?format=json', { agent, timeout: 10000 }, (resp) => {
        let body = '';
        resp.on('data', (d) => (body += d));
        resp.on('end', () => {
          try {
            resolve({ ok: true, ip: JSON.parse(body).ip });
          } catch {
            resolve({ ok: false, error: 'Resposta inesperada do teste (HTTP ' + resp.statusCode + ')' });
          }
        });
      });
      r.on('timeout', () => {
        r.destroy();
        resolve({ ok: false, error: 'Timeout de 10s: proxy lento ou inacessível' });
      });
      r.on('error', (e) => resolve({ ok: false, error: e.message }));
    });
    res.json({ ...out, latencyMs: Date.now() - t0 });
  })
);

// ---------------------------------------------------------------- batches
app.post(
  '/api/batches',
  wrap((req, res) => {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: 'Nome obrigatório' });
    const batch: Batch = {
      id: uid(),
      name: String(b.name),
      status: ['active', 'paused', 'draft'].includes(b.status) ? b.status : 'paused',
      templateId: b.templateId || '',
      category: b.category === 'warming' ? 'warming' : 'prospecting',
      intervalSeconds: Math.max(10, Number(b.intervalSeconds) || 60),
      assignedChipIds: Array.isArray(b.assignedChipIds) ? b.assignedChipIds : [],
      createdAt: new Date().toISOString(),
    };
    db.batches.unshift(batch);
    save();
    res.json({ success: true, id: batch.id });
  })
);

app.put(
  '/api/batches/:id',
  wrap((req, res) => {
    const b = db.batches.find((x) => x.id === req.params.id);
    if (!b) return res.status(404).json({ error: 'Lote não encontrado' });
    const u = req.body || {};
    if (['active', 'paused', 'completed', 'draft'].includes(u.status)) {
      b.status = u.status;
      if (u.status === 'active') b.nextDispatchAt = undefined;
    }
    if (u.name) b.name = String(u.name);
    if (u.templateId !== undefined) b.templateId = u.templateId;
    if (Number(u.intervalSeconds) >= 10) b.intervalSeconds = Number(u.intervalSeconds);
    if (Array.isArray(u.assignedChipIds)) b.assignedChipIds = u.assignedChipIds;
    save();
    res.json({ success: true });
  })
);

app.delete(
  '/api/batches/:id',
  wrap((req, res) => {
    db.batches = db.batches.filter((b) => b.id !== req.params.id);
    db.leads = db.leads.filter((l) => l.batchId !== req.params.id || l.status === 'opt_out');
    save();
    res.json({ success: true });
  })
);

// -------------------------------------------------------------- templates
app.post(
  '/api/templates',
  wrap((req, res) => {
    const t = req.body || {};
    if (!t.content || !String(t.content).trim()) return res.status(400).json({ error: 'Conteúdo obrigatório' });
    const existing = t.id ? db.templates.find((x) => x.id === t.id) : undefined;
    const data = {
      title: t.title || 'Template',
      category: (t.category === 'warming' ? 'warming' : 'prospecting') as Template['category'],
      content: String(t.content),
      description: t.description,
      updatedAt: new Date().toISOString(),
    };
    if (existing) Object.assign(existing, data);
    else db.templates.unshift({ id: t.id || uid(), ...data });
    save();
    res.json({ success: true });
  })
);

app.delete(
  '/api/templates/:id',
  wrap((req, res) => {
    db.templates = db.templates.filter((t) => t.id !== req.params.id);
    save();
    res.json({ success: true });
  })
);

// ------------------------------------------------------------------ leads
app.post(
  '/api/leads/batch',
  wrap((req, res) => {
    const { batchId, leads } = req.body || {};
    const batch = db.batches.find((b) => b.id === batchId);
    if (!batch) return res.status(404).json({ error: 'Lote não encontrado' });
    if (!Array.isArray(leads) || !leads.length) return res.status(400).json({ error: 'Nenhum lead enviado' });

    const inBatch = new Set(db.leads.filter((l) => l.batchId === batchId).map((l) => phoneKey(l.phone)));
    const blocked = new Set(db.leads.filter((l) => l.status === 'opt_out').map((l) => phoneKey(l.phone)));
    let added = 0,
      duplicates = 0,
      invalid = 0,
      optOut = 0;
    for (const raw of leads) {
      const phone = normalizePhone(raw.phone);
      const key = phoneKey(phone);
      if (phone.length < 12 || phone.length > 13 || !key) {
        invalid++;
        continue;
      }
      if (blocked.has(key)) {
        optOut++;
        continue;
      }
      if (inBatch.has(key)) {
        duplicates++;
        continue;
      }
      inBatch.add(key);
      db.leads.push({
        id: uid(),
        batchId,
        name: String(raw.name || 'Lead').slice(0, 120),
        city: String(raw.city || ''),
        phone,
        company: raw.company ? String(raw.company) : undefined,
        status: 'pending',
        attempts: 0,
        createdAt: new Date().toISOString(),
      } as Lead);
      added++;
    }
    if (added && batch.status === 'completed') batch.status = 'paused';
    save();
    res.json({ success: true, added, duplicates, invalid, optOut });
  })
);

// -------------------------------------------------------------- responses
app.put(
  '/api/responses/:id',
  wrap((req, res) => {
    const r = db.responses.find((x) => x.id === req.params.id);
    if (!r) return res.status(404).json({ error: 'Resposta não encontrada' });
    const b = req.body || {};
    if (['unread', 'read', 'attended'].includes(b.status)) r.status = b.status;
    if (b.responseSentiment) r.responseSentiment = b.responseSentiment;
    if (typeof b.notes === 'string') r.notes = b.notes;
    save();
    res.json({ success: true });
  })
);

app.post(
  '/api/responses/:id/reply',
  wrap(async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Texto vazio' });
    const r = await replyToResponse(req.params.id, text);
    res.status(r.ok ? 200 : 502).json(r);
  })
);

// ----------------------------------------------------------------- worker
app.post(
  '/api/worker/run-cycle',
  wrap(async (req, res) => {
    const logs = await tick({ force: true });
    res.json({ success: true, logs });
  })
);

// ----------------------------------------------------- DB (Postgres legado)
// O painel agora persiste em data/db.json. As rotas abaixo só mantêm o modal
// de Postgres funcional para quem quiser inspecionar/exportar o schema.
app.get('/api/db/status', wrap(async (req, res) => res.json(await checkDbStatus())));
app.post(
  '/api/db/connect',
  wrap(async (req, res) => {
    if (!req.body?.connectionString) return res.status(400).json({ error: 'connectionString é obrigatória.' });
    const st = await setConnectionString(req.body.connectionString);
    if (st.connected) await runMigrations();
    res.json(st);
  })
);
app.post('/api/db/migrate', wrap(async (req, res) => res.json(await runMigrations())));
app.get('/api/db/schema', (req, res) => {
  const p = path.join(__dirname, 'src', 'db', 'schema.sql');
  res.type('text/plain').send(fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : COMPLETE_DDL);
});

// -------------------------------------------------------------- Evolution
app.get('/api/evolution/config', (req, res) => {
  const s = settingsOut().evolution;
  res.json({ configured: s.configured, baseUrl: s.baseUrl, globalTokenMasked: s.globalTokenMasked });
});

app.post('/api/evolution/config', (req, res) => {
  const { baseUrl, globalToken } = req.body || {};
  if (!baseUrl) return res.status(400).json({ error: 'baseUrl é obrigatória.' });
  db.settings.evolution.baseUrl = String(baseUrl).trim().replace(/\/+$/, '');
  if (globalToken) db.settings.evolution.globalToken = String(globalToken).trim();
  save();
  res.json({ success: true, baseUrl: db.settings.evolution.baseUrl });
});

app.post(
  '/api/evolution/test',
  wrap(async (req, res) => {
    const r = await evolutionPing(req.body?.baseUrl, req.body?.globalToken);
    if (r.connected) {
      if (req.body?.baseUrl) db.settings.evolution.baseUrl = String(req.body.baseUrl).trim().replace(/\/+$/, '');
      if (req.body?.globalToken) db.settings.evolution.globalToken = String(req.body.globalToken).trim();
      save();
    }
    res.json({
      connected: r.connected,
      latencyMs: r.latencyMs,
      error: r.error,
      instancesCount: r.instances.length,
      instances: r.instances.map((i: any) => ({
        instanceName: i.name || i.instance?.instanceName || 'instancia',
        status: i.connectionStatus || i.instance?.status || 'close',
        owner: i.ownerJid || i.instance?.owner || '',
        profileName: i.profileName || i.instance?.profileName || '',
      })),
    });
  })
);

app.post(
  '/api/evolution/sync-instances',
  wrap(async (req, res) => {
    const list = await evolutionFetchInstances();
    let imported = 0;
    for (const i of list) {
      const name = i.name || i.instance?.instanceName;
      if (!name || db.chips.some((c) => c.instanceName === name)) continue;
      const open = (i.connectionStatus || i.instance?.status) === 'open';
      const owner = String(i.ownerJid || i.instance?.owner || '').split('@')[0];
      const c = newChip({ instanceName: name, provider: 'evolution', status: open ? 'active' : 'warming', phoneNumber: owner, apiKey: i.token || '' });
      c.connection = open ? 'open' : 'close';
      db.chips.unshift(c);
      imported++;
    }
    save();
    res.json({ success: true, count: imported });
  })
);

// QR / envio de teste direto por nome de instância (usados pelo modal "Evolution API")
app.get(
  '/api/evolution/instance/qrcode/:name',
  wrap(async (req, res) => {
    const fake = { instanceName: req.params.name, apiKey: '', provider: 'evolution' } as Chip;
    const r = await evolutionProvider.getQr(fake);
    res.json({ base64: r.qr, pairingCode: r.pairingCode, status: r.state, error: r.error });
  })
);

app.post(
  '/api/evolution/send-text',
  wrap(async (req, res) => {
    const { instanceName, number, text } = req.body || {};
    if (!instanceName || !number || !text) return res.status(400).json({ error: 'Parâmetros incompletos para envio' });
    const fake = { instanceName, apiKey: '', provider: 'evolution' } as Chip;
    const r = await evolutionProvider.sendText(fake, normalizePhone(number), String(text), 1200);
    res.json(r.ok ? { key: { id: r.messageId }, status: 'success' } : { error: r.error });
  })
);

app.post(
  '/api/evolution/webhook/register',
  wrap(async (req, res) => {
    const url = evolutionWebhookUrl();
    if (!url) return res.status(400).json({ error: 'Defina a URL pública do painel nas Configurações primeiro.' });
    const out: Record<string, string> = {};
    for (const c of db.chips.filter((x) => x.provider === 'evolution')) {
      try {
        await evolutionSetWebhook(c.instanceName, url);
        out[c.instanceName] = 'ok';
      } catch (e: any) {
        out[c.instanceName] = e.message;
      }
    }
    res.json({ url, result: out });
  })
);

// Webhook real da Evolution (aceita com ou sem sufixo /messages-upsert quando "webhook by events" está ligado)
app.post(['/api/webhook/evolution', '/api/webhook/evolution/*'], (req, res) => handleEvolutionWebhook(req, res));

function handleEvolutionWebhook(req: Request, res: Response) {
  const token = (req.query.token as string) || (req.headers['x-webhook-token'] as string) || '';
  if (!safeEq(token, db.settings.webhookToken)) return res.status(401).json({ error: 'token inválido' });
  try {
    const body = req.body || {};
    const event = String(body.event || '').toLowerCase().replace(/_/g, '.');
    const chip = db.chips.find((c) => c.instanceName === body.instance || c.instanceName === body.instanceName);
    if (chip && event === 'connection.update') {
      const st = body.data?.state;
      chip.connection = st === 'open' ? 'open' : st === 'connecting' ? 'connecting' : 'close';
      save();
    }
    if (chip && event === 'messages.upsert') {
      const items = Array.isArray(body.data) ? body.data : [body.data];
      for (const d of items) {
        if (!d?.key || d.key.fromMe) continue;
        let jid: string = d.key.remoteJid || '';
        if (!jid || jid.endsWith('@g.us') || jid.includes('broadcast')) continue;
        if (jid.endsWith('@lid')) jid = d.key.senderPn || d.key.remoteJidAlt || jid;
        const m = d.message || {};
        const text =
          m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption ||
          m.buttonsResponseMessage?.selectedDisplayText || m.listResponseMessage?.title ||
          (m.audioMessage ? '[áudio]' : m.imageMessage ? '[imagem]' : m.documentMessage ? '[documento]' : '');
        if (!text) continue;
        emitInbound({
          chipId: chip.id,
          from: jid.split('@')[0].replace(/\D/g, ''),
          pushName: d.pushName,
          text,
          messageId: d.key.id,
          ts: Number(d.messageTimestamp) * 1000 || Date.now(),
        });
      }
    }
    res.json({ received: true });
  } catch (e: any) {
    console.error('[webhook]', e.message);
    res.status(500).json({ error: e.message });
  }
}

// ------------------------------------------------------------ dev / teste
app.post(
  '/api/dev/simulate-inbound',
  wrap((req, res) => {
    if (isProd && process.env.ALLOW_DEV_ROUTES !== '1') return res.status(404).json({ error: 'indisponível em produção' });
    const { chipId, phone, text } = req.body || {};
    const chip = db.chips.find((c) => c.id === chipId) || db.chips[0];
    if (!chip || !phone || !text) return res.status(400).json({ error: 'chipId, phone e text são obrigatórios' });
    emitInbound({ chipId: chip.id, from: normalizePhone(phone), text: String(text), messageId: 'sim-' + Date.now(), pushName: req.body.pushName });
    res.json({ success: true });
  })
);

// ------------------------------------------------------------------ boot
async function start() {
  if (isProd) {
    const dist = path.join(__dirname, 'dist');
    app.use(express.static(dist));
    app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`⚡ ZapPulse rodando em http://localhost:${port}`);
    console.log(`   Provedor padrão: ${db.settings.defaultProvider} | Painel ${process.env.PANEL_PASSWORD ? 'protegido por senha' : 'SEM senha (defina PANEL_PASSWORD)'}`);
    startEngine();
    baileysProvider.boot?.(db.chips).catch((e) => console.error('[boot]', e));
    syncConnections().catch(() => {});
  });
}

start().catch((err) => {
  console.error('Falha ao iniciar:', err);
  process.exit(1);
});
