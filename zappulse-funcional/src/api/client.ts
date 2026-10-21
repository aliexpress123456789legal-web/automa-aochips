import { DbStatus } from '../db/postgres';
import { AppSettings, ServerState } from '../types';

async function call<T = any>(method: string, url: string, body?: any): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Erro HTTP ${res.status}`);
  }
  return data as T;
}

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch {
    return fallback;
  }
};

export const apiClient = {
  // ---- estado completo (fonte única da verdade = servidor)
  getState: () => call<ServerState>('GET', '/api/state'),

  // ---- chips
  createChip: (chip: any) => call<{ success: boolean; chip: any }>('POST', '/api/chips', chip),
  updateChip: (id: string, updates: any) =>
    call<{ success: boolean; proxyApplied?: boolean; proxyError?: string }>('PUT', `/api/chips/${id}`, updates),
  deleteChip: (id: string) => call('DELETE', `/api/chips/${id}`),
  getChipQr: (id: string, phone?: string) =>
    call<{ state: 'open' | 'connecting' | 'close'; qr?: string; pairingCode?: string; error?: string }>(
      'GET',
      `/api/chips/${id}/qr${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`
    ),
  testChip: (id: string) => call<{ state: string; error?: string; latencyMs: number }>('POST', `/api/chips/${id}/test`),
  logoutChip: (id: string) => call('POST', `/api/chips/${id}/logout`),
  sendTestMessage: (id: string, number: string, text: string) =>
    call<{ ok: boolean; error?: string }>('POST', `/api/chips/${id}/send-test`, { number, text }),

  // ---- lotes / templates / leads
  saveBatch: (batch: any) => call<{ success: boolean; id: string }>('POST', '/api/batches', batch),
  updateBatch: (id: string, updates: any) => call('PUT', `/api/batches/${id}`, updates),
  deleteBatch: (id: string) => call('DELETE', `/api/batches/${id}`),
  saveTemplate: (tpl: any) => call('POST', '/api/templates', tpl),
  deleteTemplate: (id: string) => call('DELETE', `/api/templates/${id}`),
  importLeads: (batchId: string, leads: any[]) =>
    call<{ success: boolean; added: number; duplicates: number; invalid: number; optOut: number }>(
      'POST',
      '/api/leads/batch',
      { batchId, leads }
    ),

  // ---- respostas
  updateResponse: (id: string, updates: any) => call('PUT', `/api/responses/${id}`, updates),
  replyResponse: (id: string, text: string) => call<{ ok: boolean; error?: string }>('POST', `/api/responses/${id}/reply`, { text }),
  simulateInbound: (chipId: string, phone: string, text: string) =>
    call('POST', '/api/dev/simulate-inbound', { chipId, phone, text }),

  // ---- worker / configurações
  runWorkerCycle: async (): Promise<{ success: boolean; logs: string[]; message?: string }> => {
    try {
      return await call('POST', '/api/worker/run-cycle');
    } catch (e: any) {
      return { success: false, logs: [`❌ ${e.message}`], message: e.message };
    }
  },
  updateSettings: (s: Partial<AppSettings> | Record<string, any>) => call<AppSettings>('PUT', '/api/settings', s),

  // ---- Postgres (legado; opcional)
  getDbStatus: (): Promise<DbStatus> =>
    safe(() => call<DbStatus>('GET', '/api/db/status'), { connected: false, error: 'Servidor local offline' } as DbStatus),
  connectDb: (connectionString: string): Promise<DbStatus> =>
    safe(() => call<DbStatus>('POST', '/api/db/connect', { connectionString }), { connected: false, error: 'Falha' } as DbStatus),
  runMigration: () =>
    safe(() => call<{ success: boolean; message: string }>('POST', '/api/db/migrate'), { success: false, message: 'Falha' }),

  // ---- Evolution API
  getEvolutionConfig: () =>
    safe(() => call<{ configured: boolean; baseUrl: string; globalTokenMasked: string }>('GET', '/api/evolution/config'), {
      configured: false,
      baseUrl: '',
      globalTokenMasked: '',
    }),
  saveEvolutionConfig: (config: { baseUrl: string; globalToken?: string }) =>
    safe(() => call<{ success: boolean; baseUrl: string }>('POST', '/api/evolution/config', config), {
      success: false,
      baseUrl: '',
    }),
  testEvolutionConnection: (params: { baseUrl: string; globalToken: string }) =>
    safe(
      () =>
        call<{ connected: boolean; latencyMs?: number; instancesCount?: number; instances?: any[]; error?: string }>(
          'POST',
          '/api/evolution/test',
          params
        ),
      { connected: false, error: 'Servidor local offline' }
    ),
  syncEvolutionInstances: () =>
    safe(() => call<{ success: boolean; count: number; error?: string }>('POST', '/api/evolution/sync-instances'), {
      success: false,
      count: 0,
      error: 'Falha de rede',
    }),
  getEvolutionQrCode: (instanceName: string) =>
    safe(() => call<any>('GET', `/api/evolution/instance/qrcode/${encodeURIComponent(instanceName)}`), { error: 'Falha de rede' } as any),
  sendEvolutionTestMessage: (params: { instanceName: string; number: string; text: string }) =>
    safe(() => call<any>('POST', '/api/evolution/send-text', params), { error: 'Falha de rede' } as any),
  registerEvolutionWebhooks: () => call<{ url: string; result: Record<string, string> }>('POST', '/api/evolution/webhook/register'),
};
