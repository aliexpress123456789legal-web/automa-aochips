import type { Chip, ConnState } from '../store';

export interface SendResult {
  ok: boolean;
  error?: string;
  messageId?: string;
  notOnWhatsapp?: boolean;
  /** erro de conexão/instância (não culpa do lead) */
  connectionError?: boolean;
}

export interface QrResult {
  state: ConnState;
  qr?: string; // data URL (png)
  pairingCode?: string;
  error?: string;
}

export interface InboundEvent {
  chipId: string;
  /** apenas dígitos do remetente */
  from: string;
  pushName?: string;
  text: string;
  messageId?: string;
  ts?: number;
}

export interface Provider {
  name: 'evolution' | 'baileys' | 'mock';
  /** estado real atual da conexão */
  getState(chip: Chip): Promise<{ state: ConnState; ownerNumber?: string; error?: string }>;
  getQr(chip: Chip, opts?: { phone?: string }): Promise<QrResult>;
  sendText(chip: Chip, number: string, text: string, typingMs: number): Promise<SendResult>;
  applyProxy?(chip: Chip): Promise<{ ok: boolean; error?: string }>;
  logout?(chip: Chip): Promise<void>;
  remove?(chip: Chip): Promise<void>;
  /** chamado no boot para religar sessões existentes */
  boot?(chips: Chip[]): Promise<void>;
}

type Handler = (e: InboundEvent) => void | Promise<void>;
let inboundHandler: Handler = () => {};
export function setInboundHandler(h: Handler) {
  inboundHandler = h;
}
export function emitInbound(e: InboundEvent) {
  Promise.resolve(inboundHandler(e)).catch((err) => console.error('[inbound]', err));
}

export type ConnHandler = (chipId: string, state: ConnState, extra?: { owner?: string; error?: string }) => void;
let connHandler: ConnHandler = () => {};
export function setConnHandler(h: ConnHandler) {
  connHandler = h;
}
export function emitConn(chipId: string, state: ConnState, extra?: { owner?: string; error?: string }) {
  connHandler(chipId, state, extra);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
