import { Pool } from 'pg';

let activePool: Pool | null = null;
let currentConnectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

export interface DbStatus {
  connected: boolean;
  database?: string;
  host?: string;
  latencyMs?: number;
  tableCounts?: {
    agents: number;
    batches: number;
    leads: number;
    message_templates: number;
    logs_communication: number;
    lead_responses: number;
  };
  error?: string;
  connectionStringMasked?: string;
}

export function maskConnectionString(str: string): string {
  if (!str) return '';
  return str.replace(/\/\/([^:]+):([^@]+)@/, '//$1:••••••••@');
}

export function getPool(): Pool | null {
  if (!activePool && currentConnectionString) {
    try {
      activePool = new Pool({
        connectionString: currentConnectionString,
        connectionTimeoutMillis: 5000,
        ssl:
          currentConnectionString.includes('sslmode=require') ||
          currentConnectionString.includes('amazonaws.com') ||
          currentConnectionString.includes('supabase.co')
            ? { rejectUnauthorized: false }
            : false,
      });

      activePool.on('error', (err) => {
        console.error('PostgreSQL Pool idle error:', err.message);
      });
    } catch (e) {
      console.error('Failed to instantiate Pool:', e);
    }
  }
  return activePool;
}

export async function setConnectionString(newConn: string): Promise<DbStatus> {
  if (activePool) {
    try {
      await activePool.end();
    } catch {}
    activePool = null;
  }

  currentConnectionString = newConn.trim();
  return checkDbStatus();
}

export async function checkDbStatus(): Promise<DbStatus> {
  const pool = getPool();
  if (!pool || !currentConnectionString) {
    return {
      connected: false,
      error: 'Nenhuma string de conexão PostgreSQL configurada.',
      connectionStringMasked: '',
    };
  }

  const start = Date.now();
  try {
    const res = await pool.query('SELECT current_database() as db, inet_server_addr() as host');
    const latencyMs = Date.now() - start;

    let tableCounts = {
      agents: 0,
      batches: 0,
      leads: 0,
      message_templates: 0,
      logs_communication: 0,
      lead_responses: 0,
    };

    try {
      const countsRes = await pool.query(`
        SELECT 
          (SELECT count(*) FROM information_schema.tables WHERE table_name = 'agents') as has_agents,
          (SELECT count(*) FROM information_schema.tables WHERE table_name = 'batches') as has_batches,
          (SELECT count(*) FROM information_schema.tables WHERE table_name = 'leads') as has_leads,
          (SELECT count(*) FROM information_schema.tables WHERE table_name = 'message_templates') as has_templates,
          (SELECT count(*) FROM information_schema.tables WHERE table_name = 'logs_communication') as has_logs,
          (SELECT count(*) FROM information_schema.tables WHERE table_name = 'lead_responses') as has_responses
      `);

      const r = countsRes.rows[0];
      if (Number(r.has_agents) > 0) {
        const c = await pool.query('SELECT count(*) FROM agents');
        tableCounts.agents = Number(c.rows[0].count);
      }
      if (Number(r.has_batches) > 0) {
        const c = await pool.query('SELECT count(*) FROM batches');
        tableCounts.batches = Number(c.rows[0].count);
      }
      if (Number(r.has_leads) > 0) {
        const c = await pool.query('SELECT count(*) FROM leads');
        tableCounts.leads = Number(c.rows[0].count);
      }
      if (Number(r.has_templates) > 0) {
        const c = await pool.query('SELECT count(*) FROM message_templates');
        tableCounts.message_templates = Number(c.rows[0].count);
      }
      if (Number(r.has_logs) > 0) {
        const c = await pool.query('SELECT count(*) FROM logs_communication');
        tableCounts.logs_communication = Number(c.rows[0].count);
      }
      if (Number(r.has_responses) > 0) {
        const c = await pool.query('SELECT count(*) FROM lead_responses');
        tableCounts.lead_responses = Number(c.rows[0].count);
      }
    } catch (e) {
      console.warn('Error reading table counts:', e);
    }

    return {
      connected: true,
      database: res.rows[0]?.db || 'postgres',
      host: res.rows[0]?.host || 'remote',
      latencyMs,
      tableCounts,
      connectionStringMasked: maskConnectionString(currentConnectionString),
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message || 'Falha ao conectar no banco PostgreSQL.',
      connectionStringMasked: maskConnectionString(currentConnectionString),
    };
  }
}

export const COMPLETE_DDL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE agent_status_enum AS ENUM ('new', 'warming', 'active', 'banned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_status_enum AS ENUM ('pending', 'contacted', 'converted', 'invalid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE template_category_enum AS ENUM ('warming', 'prospecting', 'batch');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE communication_status_enum AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    category VARCHAR(50) NOT NULL DEFAULT 'prospecting',
    interval_seconds INTEGER NOT NULL DEFAULT 60 CHECK (interval_seconds >= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batches_status ON batches (status);

CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    status agent_status_enum NOT NULL DEFAULT 'new',
    provider_id VARCHAR(100),
    phone_number VARCHAR(30),
    apikey VARCHAR(255),
    proxy_info JSONB,
    trust_score NUMERIC(5, 2) DEFAULT 100.00 CHECK (trust_score >= 0 AND trust_score <= 100),
    max_messages_per_hour INTEGER NOT NULL DEFAULT 20,
    warming_days INTEGER NOT NULL DEFAULT 0,
    warming_target_days INTEGER NOT NULL DEFAULT 21,
    total_sent INTEGER NOT NULL DEFAULT 0,
    total_failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
CREATE INDEX IF NOT EXISTS idx_agents_provider_id ON agents (provider_id);

CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    phone VARCHAR(30),
    rating NUMERIC(3, 2) CHECK (rating >= 0 AND rating <= 5.0),
    whatsapp VARCHAR(30),
    reviews_count INTEGER DEFAULT 0 CHECK (reviews_count >= 0),
    google_maps_link TEXT,
    instagram_handle VARCHAR(100),
    company VARCHAR(255),
    is_mobile BOOLEAN DEFAULT FALSE,
    batch_id UUID REFERENCES batches (id) ON DELETE CASCADE,
    status lead_status_enum NOT NULL DEFAULT 'pending',
    source VARCHAR(100) DEFAULT 'csv_import',
    sent_at TIMESTAMPTZ,
    agent_id UUID REFERENCES agents (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_batch_id ON leads (batch_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON leads (whatsapp);

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category template_category_enum NOT NULL DEFAULT 'prospecting',
    title VARCHAR(150),
    content TEXT NOT NULL,
    spintax_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    batch_id UUID REFERENCES batches (id) ON DELETE SET NULL,
    batch_name VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_message_templates_category ON message_templates (category);

CREATE TABLE IF NOT EXISTS logs_communication (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    message_id UUID,
    status communication_status_enum NOT NULL DEFAULT 'queued',
    sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    payload JSONB,
    
    CONSTRAINT fk_logs_sender 
        FOREIGN KEY (sender_id) 
        REFERENCES agents (id) 
        ON DELETE RESTRICT,
        
    CONSTRAINT fk_logs_receiver 
        FOREIGN KEY (receiver_id) 
        REFERENCES leads (id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_logs_template 
        FOREIGN KEY (message_id) 
        REFERENCES message_templates (id) 
        ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_sender_id ON logs_communication (sender_id);
CREATE INDEX IF NOT EXISTS idx_logs_receiver_id ON logs_communication (receiver_id);
CREATE INDEX IF NOT EXISTS idx_logs_status_sent_at ON logs_communication (status, sent_at DESC);

CREATE TABLE IF NOT EXISTS lead_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads (id) ON DELETE SET NULL,
    batch_id UUID REFERENCES batches (id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents (id) ON DELETE SET NULL,
    lead_name VARCHAR(255),
    lead_phone VARCHAR(30) NOT NULL,
    lead_city VARCHAR(100),
    message_received TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    response_sentiment VARCHAR(50) DEFAULT 'interested',
    status VARCHAR(50) DEFAULT 'unread',
    outbound_message_sent TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_responses_received_at ON lead_responses (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_responses_batch_id ON lead_responses (batch_id);
CREATE INDEX IF NOT EXISTS idx_lead_responses_phone ON lead_responses (lead_phone);

CREATE OR REPLACE VIEW vw_dashboard_kpis AS
SELECT
    (SELECT count(*) FROM agents WHERE status = 'active') AS active_agents,
    (SELECT count(*) FROM agents WHERE status = 'warming') AS warming_agents,
    (SELECT count(*) FROM agents WHERE status = 'banned') AS banned_agents,
    (SELECT COALESCE(AVG(trust_score), 0) FROM agents) AS avg_trust_score,
    (SELECT count(*) FROM leads WHERE status = 'pending') AS pending_leads,
    (SELECT count(*) FROM leads WHERE status = 'contacted') AS contacted_leads,
    (SELECT count(*) FROM logs_communication WHERE status = 'sent') AS total_sent_messages,
    (SELECT count(*) FROM lead_responses WHERE status = 'unread') AS unread_responses;
`;

export async function runMigrations(): Promise<{ success: boolean; message: string }> {
  const pool = getPool();
  if (!pool) {
    return { success: false, message: 'Banco PostgreSQL não conectado.' };
  }

  try {
    await pool.query(COMPLETE_DDL);
    return {
      success: true,
      message:
        'Schema PostgreSQL criado com sucesso: ENUMs (agent_status_enum, lead_status_enum, template_category_enum, communication_status_enum), tabelas agents, batches, leads, message_templates, logs_communication e lead_responses instalados!',
    };
  } catch (err: any) {
    return { success: false, message: `Erro ao aplicar DDL: ${err.message}` };
  }
}
