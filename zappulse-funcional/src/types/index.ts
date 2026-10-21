export type ChipStatus = 'active' | 'warming' | 'banned' | 'paused';
export type ProviderName = 'evolution' | 'baileys' | 'mock';
export type ConnState = 'open' | 'connecting' | 'close';
export type ProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5';

export interface ChipProxyConfig {
  enabled: boolean;
  host: string;
  port: string;
  protocol: ProxyProtocol;
  username?: string;
  password?: string;
  lastTestedAt?: string;
  testStatus?: 'success' | 'failed' | 'untested';
  externalIp?: string;
}

export interface AgentChip {
  id: string;
  instanceName: string;
  phoneNumber: string;
  apiKey: string;
  status: ChipStatus;
  trustScore: number; // 0 to 100
  msgsPerHour: number;
  maxMsgsPerHour: number;
  warmingDays: number;
  warmingTargetDays: number;
  totalSent: number;
  totalFailed: number;
  lastSyncAt: string;
  batteryPercent?: number;
  connectionQuality: 'optimal' | 'warning' | 'disconnected';
  deviceInfo?: string;
  proxy?: ChipProxyConfig;
  provider?: ProviderName;
  connection?: ConnState;
  connectionError?: string;
  cooldownUntil?: number;
}

export type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft';
export type TemplateCategory = 'prospecting' | 'warming';

export interface Batch {
  id: string;
  name: string;
  status: CampaignStatus;
  templateId: string;
  category: TemplateCategory;
  totalLeads: number;
  sentCount: number;
  deliveredCount: number;
  repliedCount: number;
  failedCount: number;
  intervalSeconds: number; // e.g., 60 seconds between dispatches
  assignedChipIds: string[];
  createdAt: string;
  lastDispatchedAt?: string;
  nextDispatchAt?: string;
  pendingCount?: number;
  optOutCount?: number;
}

export interface Template {
  id: string;
  title: string;
  category: TemplateCategory;
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
  sentAt?: string;
  agentId?: string;
  dispatchedMessage?: string;
}

export type ResponseSentiment =
  | 'interested'
  | 'pricing'
  | 'curious'
  | 'not_interested'
  | 'unsubscribed'
  | 'neutral';

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
  responseSentiment: ResponseSentiment;
  status: 'unread' | 'read' | 'attended';
  outboundMessageSent: string;
  notes?: string;
}

export interface HourlyTelemetry {
  hour: string; // "00h", "01h", ..., "23h"
  sent: number;
  replied: number;
  failed: number;
}

export interface AppSettings {
  defaultProvider: ProviderName;
  evolution: { baseUrl: string; globalTokenMasked: string; configured: boolean };
  workerEnabled: boolean;
  window: { enabled: boolean; start: string; end: string; days: number[]; timezone: string };
  dailyLimitPerChip: number;
  optOutKeywords: string[];
  webhookToken: string;
  publicUrl: string;
  webhookUrl: string;
  panelProtected: boolean;
}

export interface EngineLog {
  id: string;
  ts: number;
  kind: 'prospect' | 'warming' | 'reply' | 'system';
  chipId?: string;
  ok: boolean;
  message?: string;
  error?: string;
}

export interface EngineInfo {
  running: boolean;
  inWindow: boolean;
  lastTickAt: number;
  reason: string;
  recentLogs: EngineLog[];
}

export interface ServerState {
  chips: AgentChip[];
  batches: Batch[];
  templates: Template[];
  responses: LeadResponse[];
  telemetry: HourlyTelemetry[];
  settings: AppSettings;
  engine: EngineInfo;
}
