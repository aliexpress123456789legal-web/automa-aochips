/**
 * Armazenamento persistente em arquivo JSON (data/db.json).
 * Fonte única da verdade do painel: funciona sem Postgres e sem Evolution.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID, randomBytes } from 'crypto';

export type ProviderName = 'evolution' | 'baileys' | 'mock';
export type ConnState = 'open' | 'connecting' | 'close';

export interface Settings {
  defaultProvider: ProviderName;
  evolution: { baseUrl: string; globalToken: string };
  workerEnabled: boolean;
  window: { enabled: boolean; start: string; end: string; days: number[]; timezone: string };
  dailyLimitPerChip: number;
  optOutKeywords: string[];
  webhookToken: string;
  publicUrl: string;
}

export interface Chip {
  id: string;
  instanceName: string;
  phoneNumber: string;
  apiKey: string;
  status: 'new' | 'active' | 'warming' | 'banned' | 'paused';
  trustScore: number;
  maxMsgsPerHour: number;
  warmingTargetDays: number;
  totalSent: number;
  totalFailed: number;
  lastSyncAt: string;
  deviceInfo?: string;
  proxy?: any;
  provider: ProviderName;
  connection: ConnState;
  connectionError?: string;
  cooldownUntil?: number;
  consecutiveFailures: number;
  nextWarmAt?: number;
  warmDates: Record<string, number>; // yyyy-mm-dd -> mensagens de aquecimento
  createdAt: string;
}

export interface Batch {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  templateId: string;
  category: 'prospecting' | 'warming';
  intervalSeconds: number;
  assignedChipIds: string[];
  createdAt: string;
  lastDispatchedAt?: string;
  nextDispatchAt?: number;
}

export interface Template {
  id: string;
  title: string;
  category: 'prospecting' | 'warming';
  content: string;
  description?: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  batchId: string;
  name: string;
  city: string;
  phone: string;
  company?: string;
  status: 'pending' | 'sent' | 'replied' | 'failed' | 'opt_out';
  attempts: number;
  sentAt?: string;
  agentId?: string;
  dispatchedMessage?: string;
  error?: string;
  createdAt: string;
}

export interface LeadResponse {
  id: string;
  leadId: string;
  batchId: string;
  agentId: string;
  leadPhone: string;
  leadName: string;
  leadCity: string;
  messageReceived: string;
  receivedAt: string;
  responseSentiment: string;
  status: 'unread' | 'read' | 'attended';
  outboundMessageSent: string;
  externalId?: string;
  notes?: string;
}

export interface LogEntry {
  id: string;
  ts: number;
  kind: 'prospect' | 'warming' | 'reply' | 'system';
  chipId?: string;
  leadId?: string;
  batchId?: string;
  ok: boolean;
  message?: string;
  error?: string;
}

export interface DB {
  settings: Settings;
  chips: Chip[];
  batches: Batch[];
  templates: Template[];
  leads: Lead[];
  responses: LeadResponse[];
  logs: LogEntry[];
}

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'db.json');

export const dataDir = DATA_DIR;
export const uid = () => randomUUID();

function defaults(): DB {
  return {
    settings: {
      defaultProvider: (process.env.DEFAULT_PROVIDER as ProviderName) || 'baileys',
      evolution: {
        baseUrl: (process.env.EVOLUTION_BASE_URL || '').replace(/\/+$/, ''),
        globalToken: process.env.EVOLUTION_GLOBAL_TOKEN || '',
      },
      workerEnabled: true,
      window: {
        enabled: true,
        start: '08:00',
        end: '20:00',
        days: [1, 2, 3, 4, 5, 6],
        timezone: process.env.TZ_NAME || 'America/Sao_Paulo',
      },
      dailyLimitPerChip: 200,
      optOutKeywords: ['sair', 'parar', 'pare', 'stop', 'cancelar', 'remover', 'não quero', 'nao quero', 'descadastrar'],
      webhookToken: randomBytes(12).toString('hex'),
      publicUrl: process.env.APP_URL || '',
    },
    chips: [],
    batches: [],
    templates: [],
    leads: [],
    responses: [],
    logs: [],
  };
}

function load(): DB {
  const base = defaults();
  try {
    if (fs.existsSync(FILE)) {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
      return {
        ...base,
        ...raw,
        settings: {
          ...base.settings,
          ...raw.settings,
          evolution: { ...base.settings.evolution, ...(raw.settings?.evolution || {}) },
          window: { ...base.settings.window, ...(raw.settings?.window || {}) },
        },
      };
    }
  } catch (e: any) {
    console.error('[store] db.json corrompido, fazendo backup e recomeçando:', e.message);
    try {
      fs.renameSync(FILE, FILE + '.corrupt-' + Date.now());
    } catch {}
  }
  return base;
}

export const db: DB = load();

let timer: NodeJS.Timeout | null = null;

function flush() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  } catch (e: any) {
    console.error('[store] falha ao salvar:', e.message);
  }
}

export function save() {
  if (db.logs.length > 8000) db.logs.splice(0, db.logs.length - 6000);
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, 300);
}

export function saveNow() {
  if (timer) clearTimeout(timer);
  timer = null;
  flush();
}

process.on('SIGINT', () => {
  saveNow();
  process.exit(0);
});
process.on('SIGTERM', () => {
  saveNow();
  process.exit(0);
});

export function addLog(l: Omit<LogEntry, 'id' | 'ts'>) {
  db.logs.push({ id: uid(), ts: Date.now(), ...l });
  save();
}
