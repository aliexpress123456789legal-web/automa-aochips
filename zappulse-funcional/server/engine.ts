/**
 * Motor do ZapPulse: worker de disparo/aquecimento, recebimento de respostas
 * e sincronização do estado de conexão dos chips.
 */
import { Batch, Chip, Lead, LeadResponse, addLog, db, save, uid } from './store';
import { formatE164, normalizePhone, phoneKey } from './phone';
import { renderMessage } from './spintax';
import { InboundEvent, emitConn, providerFor, setConnHandler, setInboundHandler, sleep } from './providers';

const HOUR = 3600_000;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// ---------------------------------------------------------------- helpers

function zonedNow(): { dow: number; minutes: number; date: string } {
  const tz = db.settings.window.timezone || 'America/Sao_Paulo';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const g = (t: string) => parts.find((p) => p.type === t)?.value || '';
    const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const hour = parseInt(g('hour'), 10) % 24;
    return {
      dow: dowMap[g('weekday')] ?? 0,
      minutes: hour * 60 + parseInt(g('minute'), 10),
      date: `${g('year')}-${g('month')}-${g('day')}`,
    };
  } catch {
    const d = new Date();
    return { dow: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes(), date: d.toISOString().slice(0, 10) };
  }
}

const toMin = (hhmm: string) => {
  const [h, m] = (hhmm || '0:0').split(':').map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
};

export function inSendingWindow(): boolean {
  const w = db.settings.window;
  if (!w.enabled) return true;
  const n = zonedNow();
  if (!w.days.includes(n.dow)) return false;
  return n.minutes >= toMin(w.start) && n.minutes < toMin(w.end);
}

export function sentSince(chipId: string, ms: number, kinds?: string[]): number {
  const from = Date.now() - ms;
  let n = 0;
  for (let i = db.logs.length - 1; i >= 0; i--) {
    const l = db.logs[i];
    if (l.ts < from) break;
    if (l.chipId === chipId && l.ok && l.kind !== 'system' && (!kinds || kinds.includes(l.kind))) n++;
  }
  return n;
}

export const sentLastHour = (chipId: string) => sentSince(chipId, HOUR);
const sentToday = (chipId: string) => sentSince(chipId, 24 * HOUR);

const chipReady = (c: Chip) => c.connection === 'open' && !(c.cooldownUntil && c.cooldownUntil > Date.now());

function typingDelay(text: string): number {
  // simula digitação humana: ~ 25ms/caractere, entre 1.2s e 6s
  return Math.min(6000, Math.max(1200, text.length * 25 + rand(300, 1200)));
}

// -------------------------------------------------------------- status log

let lastStatusMsg = '';
function status(msg: string) {
  if (msg === lastStatusMsg) return;
  lastStatusMsg = msg;
  addLog({ kind: 'system', ok: true, message: msg });
}

export const engineState = {
  running: false,
  lastTickAt: 0,
  lastReason: '' as string,
};

// ------------------------------------------------------------ chip failures

function registerFailure(chip: Chip, err: string, connectionError: boolean) {
  chip.totalFailed++;
  chip.consecutiveFailures++;
  chip.trustScore = Math.max(0, chip.trustScore - (connectionError ? 0 : 2));
  if (connectionError) {
    chip.connection = 'close';
    chip.connectionError = err;
  }
  if (chip.consecutiveFailures >= 3) {
    chip.cooldownUntil = Date.now() + 10 * 60_000;
    chip.consecutiveFailures = 0;
    status(`Chip "${chip.instanceName}" pausado por 10 min após falhas seguidas: ${err}`);
  }
}

function registerSuccess(chip: Chip) {
  chip.totalSent++;
  chip.consecutiveFailures = 0;
  chip.lastSyncAt = new Date().toISOString();
}

// -------------------------------------------------------------- prospecting

function pickChip(batch: Batch): Chip | null {
  const pool = db.chips.filter(
    (c) =>
      c.status === 'active' &&
      chipReady(c) &&
      (batch.assignedChipIds.length === 0 || batch.assignedChipIds.includes(c.id)) &&
      sentLastHour(c.id) < c.maxMsgsPerHour &&
      sentToday(c.id) < db.settings.dailyLimitPerChip
  );
  if (!pool.length) return null;
  // o menos usado na última hora tem prioridade; empate → aleatório
  const scored = pool.map((c) => ({ c, load: sentLastHour(c.id) / Math.max(1, c.maxMsgsPerHour) + Math.random() * 0.05 }));
  scored.sort((a, b) => a.load - b.load);
  return scored[0].c;
}

function whyNoChip(batch: Batch): string {
  const cands = db.chips.filter((c) => batch.assignedChipIds.length === 0 || batch.assignedChipIds.includes(c.id));
  if (!cands.length) return 'nenhum chip vinculado ao lote';
  const active = cands.filter((c) => c.status === 'active');
  if (!active.length) return 'nenhum chip com status ATIVO neste lote (chips em aquecimento não disparam prospecção)';
  const open = active.filter(chipReady);
  if (!open.length) return 'chips ativos estão desconectados ou em pausa — leia o QR Code / verifique o provedor';
  return 'todos os chips atingiram o limite por hora/dia';
}

async function dispatchOne(batch: Batch): Promise<void> {
  const lead = db.leads.find((l) => l.batchId === batch.id && l.status === 'pending');
  if (!lead) {
    batch.status = 'completed';
    status(`Lote "${batch.name}" concluído (sem leads pendentes).`);
    save();
    return;
  }

  // Respeita opt-out: mesmo telefone já pediu para sair em qualquer lote
  const key = phoneKey(lead.phone);
  if (!key) {
    lead.status = 'failed';
    lead.error = 'Telefone inválido';
    save();
    return;
  }
  if (db.leads.some((l) => l.status === 'opt_out' && phoneKey(l.phone) === key)) {
    lead.status = 'opt_out';
    lead.error = 'Contato pediu para não receber mensagens';
    save();
    return;
  }

  const chip = pickChip(batch);
  if (!chip) {
    batch.nextDispatchAt = Date.now() + 20_000;
    engineState.lastReason = `Lote "${batch.name}" aguardando: ${whyNoChip(batch)}`;
    status(engineState.lastReason);
    return;
  }

  const tpl =
    db.templates.find((t) => t.id === batch.templateId) || db.templates.find((t) => t.category === 'prospecting');
  if (!tpl) {
    batch.status = 'paused';
    status(`Lote "${batch.name}" pausado: nenhum template de prospecção cadastrado.`);
    save();
    return;
  }

  const text = renderMessage(tpl.content, { name: lead.name, city: lead.city, company: lead.company || '' });
  const number = normalizePhone(lead.phone);
  const provider = providerFor(chip);

  lead.attempts = (lead.attempts || 0) + 1;
  const res = await provider.sendText(chip, number, text, typingDelay(text));
  const now = new Date().toISOString();

  if (res.ok) {
    lead.status = 'sent';
    lead.sentAt = now;
    lead.agentId = chip.id;
    lead.dispatchedMessage = text;
    lead.error = undefined;
    batch.lastDispatchedAt = now;
    registerSuccess(chip);
    addLog({ kind: 'prospect', ok: true, chipId: chip.id, leadId: lead.id, batchId: batch.id, message: text });
  } else if (res.notOnWhatsapp) {
    lead.status = 'failed';
    lead.error = res.error || 'Número sem WhatsApp';
    addLog({ kind: 'prospect', ok: false, chipId: chip.id, leadId: lead.id, batchId: batch.id, error: lead.error });
  } else {
    lead.error = res.error;
    if (lead.attempts >= 3) lead.status = 'failed';
    registerFailure(chip, res.error || 'erro desconhecido', Boolean(res.connectionError));
    addLog({ kind: 'prospect', ok: false, chipId: chip.id, leadId: lead.id, batchId: batch.id, error: res.error });
  }
  save();
}

// ------------------------------------------------------------------ warming

function warmingTemplate(): string | null {
  const list = db.templates.filter((t) => t.category === 'warming');
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)].content;
}

function bumpWarming(chip: Chip) {
  const { date } = zonedNow();
  chip.warmDates[date] = (chip.warmDates[date] || 0) + 1;
  chip.trustScore = Math.min(100, chip.trustScore + 0.25);
}

export const warmingDays = (c: Chip) => Object.values(c.warmDates || {}).filter((n) => n >= 5).length;

async function warmingStep(): Promise<void> {
  const open = db.chips.filter((c) => (c.status === 'warming' || c.status === 'active') && chipReady(c) && c.phoneNumber);
  const warmers = open.filter((c) => c.status === 'warming');
  if (warmers.length === 0 || open.length < 2) return;
  const content = warmingTemplate();
  if (!content) return;

  for (const chip of warmers) {
    if (chip.nextWarmAt && chip.nextWarmAt > Date.now()) continue;
    const perHour = Math.max(1, Math.min(chip.maxMsgsPerHour, 12));
    chip.nextWarmAt = Date.now() + (HOUR / perHour) * rand(0.6, 1.6);
    if (sentLastHour(chip.id) >= chip.maxMsgsPerHour) continue;
    const peers = open.filter((p) => p.id !== chip.id && phoneKey(p.phoneNumber) !== phoneKey(chip.phoneNumber));
    if (!peers.length) continue;
    const peer = peers[Math.floor(Math.random() * peers.length)];
    const text = renderMessage(content, { name: peer.instanceName, city: '', company: '' });
    const res = await providerFor(chip).sendText(chip, normalizePhone(peer.phoneNumber), text, typingDelay(text));
    if (res.ok) {
      registerSuccess(chip);
      bumpWarming(chip);
      addLog({ kind: 'warming', ok: true, chipId: chip.id, message: `→ ${peer.instanceName}: ${text}` });
    } else {
      registerFailure(chip, res.error || 'erro', Boolean(res.connectionError));
      addLog({ kind: 'warming', ok: false, chipId: chip.id, error: res.error });
    }
    chip.warmingTargetDays = chip.warmingTargetDays || 21;
    save();
    break; // um aquecimento por tick
  }
}

// --------------------------------------------------------------------- tick

let ticking = false;

export async function tick(opts: { force?: boolean } = {}): Promise<string[]> {
  const notes: string[] = [];
  if (ticking) return ['Worker já está executando um ciclo.'];
  ticking = true;
  engineState.lastTickAt = Date.now();
  try {
    if (!db.settings.workerEnabled && !opts.force) return ['Worker desligado nas configurações.'];
    if (!inSendingWindow() && !opts.force) {
      engineState.lastReason = 'Fora da janela de envio configurada.';
      return [engineState.lastReason];
    }
    engineState.lastReason = '';

    await warmingStep();

    for (const batch of db.batches) {
      if (batch.status !== 'active' || batch.category !== 'prospecting') continue;
      if (!opts.force && batch.nextDispatchAt && batch.nextDispatchAt > Date.now()) continue;
      const before = db.leads.filter((l) => l.batchId === batch.id && l.status === 'sent').length;
      await dispatchOne(batch);
      const after = db.leads.filter((l) => l.batchId === batch.id && l.status === 'sent').length;
      if (!batch.nextDispatchAt || batch.nextDispatchAt <= Date.now()) {
        batch.nextDispatchAt = Date.now() + batch.intervalSeconds * 1000 * rand(0.85, 1.35);
      }
      notes.push(
        after > before ? `Lote "${batch.name}": 1 mensagem enviada.` : `Lote "${batch.name}": ${engineState.lastReason || 'sem envio neste ciclo'}`
      );
    }
    save();
  } catch (e: any) {
    console.error('[engine] erro no ciclo:', e);
    notes.push('Erro no ciclo: ' + e.message);
  } finally {
    ticking = false;
  }
  return notes;
}

let interval: NodeJS.Timeout | null = null;

export function startEngine() {
  if (interval) return;
  engineState.running = true;
  interval = setInterval(() => {
    tick().catch((e) => console.error('[engine]', e));
  }, 3000);
  // atualiza estado de conexão real dos chips periodicamente
  setInterval(() => syncConnections().catch(() => {}), 20_000);
  setTimeout(() => syncConnections().catch(() => {}), 1500);
}

export async function syncConnections() {
  for (const chip of db.chips) {
    try {
      const st = await providerFor(chip).getState(chip);
      applyConn(chip, st.state, { owner: st.ownerNumber, error: st.error });
    } catch {}
  }
  save();
}

function applyConn(chip: Chip, state: Chip['connection'], extra?: { owner?: string; error?: string }) {
  chip.connection = state;
  chip.connectionError = state === 'open' ? undefined : extra?.error || chip.connectionError;
  if (state === 'open') {
    chip.lastSyncAt = new Date().toISOString();
    if (extra?.owner && !chip.phoneNumber) chip.phoneNumber = formatE164(extra.owner);
  }
}

setConnHandler((chipId, state, extra) => {
  const chip = db.chips.find((c) => c.id === chipId);
  if (!chip) return;
  applyConn(chip, state, extra);
  save();
});

// ----------------------------------------------------------------- inbound

function classify(text: string): string {
  const t = text.toLowerCase();
  if (isOptOut(t)) return 'unsubscribed';
  if (/(pre[çc]o|valor|quanto|or[çc]amento|custa|investimento)/.test(t)) return 'pricing';
  if (/(n[ãa]o tenho interesse|sem interesse|n[ãa]o preciso|n[ãa]o obrigado)/.test(t)) return 'not_interested';
  if (/(tenho interesse|quero|me conta|pode enviar|manda|gostaria|sim|claro|vamos|interessa)/.test(t)) return 'interested';
  if (t.includes('?') || /(como|qual|quem|o que|onde)/.test(t)) return 'curious';
  return 'neutral';
}

function isOptOut(text: string): boolean {
  const t = text.toLowerCase().trim();
  return db.settings.optOutKeywords.some((k) => {
    const kw = k.toLowerCase().trim();
    if (!kw) return false;
    // palavras curtas só valem se for a mensagem inteira (evita "pare" dentro de "preparei")
    return kw.includes(' ') ? t.includes(kw) : t === kw || new RegExp(`(^|\\W)${kw}(\\W|$)`).test(t) && t.length <= 40;
  });
}

const seenMessages = new Set<string>();

export async function handleInbound(e: InboundEvent): Promise<void> {
  const chip = db.chips.find((c) => c.id === e.chipId);
  if (!chip || !e.from) return;
  if (e.messageId) {
    const k = chip.id + ':' + e.messageId;
    if (seenMessages.has(k)) return;
    seenMessages.add(k);
    if (seenMessages.size > 5000) seenMessages.clear();
  }

  // Mensagem vinda de outro chip nosso (aquecimento) → pode responder para parecer natural
  const peer = db.chips.find((c) => c.id !== chip.id && c.phoneNumber && phoneKey(c.phoneNumber) === phoneKey(e.from));
  if (peer) {
    if (chip.status === 'warming' && chipReady(chip) && Math.random() < 0.7) {
      const content = warmingTemplate();
      if (content) {
        const text = renderMessage(content, { name: peer.instanceName, city: '', company: '' });
        const wait = rand(20_000, 90_000);
        setTimeout(async () => {
          if (sentLastHour(chip.id) >= chip.maxMsgsPerHour || !chipReady(chip)) return;
          const r = await providerFor(chip).sendText(chip, normalizePhone(e.from), text, typingDelay(text));
          if (r.ok) {
            registerSuccess(chip);
            bumpWarming(chip);
            addLog({ kind: 'warming', ok: true, chipId: chip.id, message: `↩ ${peer.instanceName}: ${text}` });
          } else registerFailure(chip, r.error || 'erro', Boolean(r.connectionError));
          save();
        }, wait);
      }
    }
    return;
  }

  const key = phoneKey(e.from);
  // lead mais recentemente contatado com esse telefone
  const lead = db.leads
    .filter((l) => phoneKey(l.phone) === key && l.status !== 'pending')
    .sort((a, b) => (b.sentAt || '').localeCompare(a.sentAt || ''))[0];

  const sentiment = classify(e.text);
  if (lead) {
    if (sentiment === 'unsubscribed') {
      lead.status = 'opt_out';
    } else if (lead.status === 'sent') {
      lead.status = 'replied';
    }
  } else if (sentiment === 'unsubscribed') {
    // contato desconhecido pediu para sair: guarda para bloquear futuros envios
    db.leads.push({
      id: uid(),
      batchId: '',
      name: e.pushName || 'Contato',
      city: '',
      phone: e.from,
      status: 'opt_out',
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
  }

  const resp: LeadResponse = {
    id: uid(),
    leadId: lead?.id || '',
    batchId: lead?.batchId || '',
    agentId: chip.id,
    leadPhone: formatE164(e.from),
    leadName: lead?.name || e.pushName || 'Contato WhatsApp',
    leadCity: lead?.city || '',
    messageReceived: e.text,
    receivedAt: new Date(e.ts || Date.now()).toISOString(),
    responseSentiment: sentiment,
    status: 'unread',
    outboundMessageSent: lead?.dispatchedMessage || '',
    externalId: e.messageId,
  };
  db.responses.unshift(resp);
  if (db.responses.length > 5000) db.responses.length = 5000;
  save();
}

setInboundHandler(handleInbound);

// ------------------------------------------------------------- quick reply

export async function replyToResponse(id: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const r = db.responses.find((x) => x.id === id);
  if (!r) return { ok: false, error: 'Resposta não encontrada' };
  let chip = db.chips.find((c) => c.id === r.agentId && chipReady(c));
  if (!chip) chip = db.chips.find((c) => chipReady(c));
  if (!chip) return { ok: false, error: 'Nenhum chip conectado para responder.' };
  const res = await providerFor(chip).sendText(chip, normalizePhone(r.leadPhone), text, typingDelay(text) / 2);
  if (!res.ok) return { ok: false, error: res.error };
  r.status = 'attended';
  r.outboundMessageSent = text;
  addLog({ kind: 'reply', ok: true, chipId: chip.id, message: `↩ ${r.leadPhone}: ${text}` });
  save();
  return { ok: true };
}

export { sleep, emitConn };
