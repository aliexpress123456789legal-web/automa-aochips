import { AgentChip, Batch, Template, Lead, LeadResponse, HourlyTelemetry } from '../types';

export const STORAGE_KEYS = {
  CHIPS: 'zappulse_chips_v2',
  BATCHES: 'zappulse_batches_v2',
  TEMPLATES: 'zappulse_templates_v2',
  LEADS: 'zappulse_leads_v2',
  RESPONSES: 'zappulse_responses_v2',
};

// Limpo: Sem dados fictícios / fakes
export const INITIAL_CHIPS: AgentChip[] = [];
export const INITIAL_BATCHES: Batch[] = [];
export const INITIAL_TEMPLATES: Template[] = [];
export const INITIAL_LEADS: Lead[] = [];
export const INITIAL_RESPONSES: LeadResponse[] = [];
export const HOURLY_TELEMETRY: HourlyTelemetry[] = [];

// Clear old fake local storage if found
try {
  const legacyKeys = [
    'zappulse_chips_v1',
    'zappulse_batches_v1',
    'zappulse_templates_v1',
    'zappulse_leads_v1',
    'zappulse_responses_v1',
  ];
  legacyKeys.forEach((key) => localStorage.removeItem(key));
} catch {}

export function getStoredData<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    const parsed = JSON.parse(item);
    // Discard any remaining fake mock IDs like 'chip-01', 'inst-sp-prospecting-01'
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id === 'chip-01') {
      localStorage.removeItem(key);
      return defaultValue;
    }
    return parsed;
  } catch (error) {
    console.error(`Erro ao carregar dados do localStorage (${key}):`, error);
    return defaultValue;
  }
}

export function setStoredData<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Erro ao salvar dados no localStorage (${key}):`, error);
  }
}
