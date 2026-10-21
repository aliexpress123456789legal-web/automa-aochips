-- =============================================================================
-- ZAPPULSE - BANCO DE DADOS POSTGRESQL PARA PROSPECÇÃO WHATSAPP & WORKER ENGINE
-- =============================================================================

-- Habilita extensão para geração de UUID nativa no PostgreSQL
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 0. Tipos Enumerados (ENUMs) para consistência de dados
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Função Auxiliar: Atualização Automática de updated_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. Tabela: batches (Lotes de Campanha / Importação)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'completed'
    category VARCHAR(50) NOT NULL DEFAULT 'prospecting', -- 'prospecting' | 'warming'
    interval_seconds INTEGER NOT NULL DEFAULT 60 CHECK (interval_seconds >= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batches_status ON batches (status);

-- -----------------------------------------------------------------------------
-- 2. Tabela: agents (Chips / Instâncias WhatsApp)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    status agent_status_enum NOT NULL DEFAULT 'new',
    provider_id VARCHAR(100),               -- Identificador da sessão/instância (ex: Z-API, Evolution, Baileys)
    phone_number VARCHAR(30),               -- Número no formato WhatsApp (+5511999999999)
    apikey VARCHAR(255),                    -- API Key individual da instância
    proxy_info JSONB,                       -- Armazena {enabled, host, port, username, password, protocol}
    trust_score NUMERIC(5, 2) DEFAULT 100.00 CHECK (trust_score >= 0 AND trust_score <= 100),
    max_messages_per_hour INTEGER NOT NULL DEFAULT 20,
    warming_days INTEGER NOT NULL DEFAULT 0,
    warming_target_days INTEGER NOT NULL DEFAULT 21,
    total_sent INTEGER NOT NULL DEFAULT 0,
    total_failed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índice para acelerar a busca de agentes por status (ex: buscar apenas 'active' ou 'warming')
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents (status);
CREATE INDEX IF NOT EXISTS idx_agents_provider_id ON agents (provider_id);

-- -----------------------------------------------------------------------------
-- 3. Tabela: leads
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    phone VARCHAR(30),
    rating NUMERIC(3, 2) CHECK (rating >= 0 AND rating <= 5.0),
    whatsapp VARCHAR(30),                   -- Formato E.164 (ex: +5511999999999)
    reviews_count INTEGER DEFAULT 0 CHECK (reviews_count >= 0),
    google_maps_link TEXT,
    instagram_handle VARCHAR(100),
    company VARCHAR(255),
    is_mobile BOOLEAN DEFAULT FALSE,
    batch_id UUID REFERENCES batches (id) ON DELETE CASCADE, -- Vinculado a um Lote
    status lead_status_enum NOT NULL DEFAULT 'pending',
    source VARCHAR(100) DEFAULT 'csv_import',
    sent_at TIMESTAMPTZ,
    agent_id UUID REFERENCES agents (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para acelerar a fila de disparo do worker e buscas por lote e telefone
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_batch_id ON leads (batch_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp ON leads (whatsapp);

-- -----------------------------------------------------------------------------
-- 4. Tabela: message_templates
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 5. Tabela: logs_communication (Histórico de Disparos & Auditoria)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 6. Tabela: lead_responses (Inbox de Respostas Recebidas via Webhook)
-- -----------------------------------------------------------------------------
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
    response_sentiment VARCHAR(50) DEFAULT 'interested', -- 'interested' | 'budget' | 'doubt' | 'declined'
    status VARCHAR(50) DEFAULT 'unread',                 -- 'unread' | 'replied' | 'archived'
    outbound_message_sent TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_responses_received_at ON lead_responses (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_responses_batch_id ON lead_responses (batch_id);
CREATE INDEX IF NOT EXISTS idx_lead_responses_phone ON lead_responses (lead_phone);

-- -----------------------------------------------------------------------------
-- Triggers de Atualização Automática
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TRIGGER set_timestamp_batches
    BEFORE UPDATE ON batches
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER set_timestamp_agents
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER set_timestamp_leads
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER set_timestamp_templates
    BEFORE UPDATE ON message_templates
    FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- -----------------------------------------------------------------------------
-- 7. Views Úteis para o Dashboard e Worker
-- -----------------------------------------------------------------------------
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

CREATE OR REPLACE VIEW vw_batches_summary AS
SELECT 
    b.id,
    b.name,
    b.status,
    b.category,
    b.interval_seconds,
    b.created_at,
    COUNT(l.id) AS total_leads,
    COUNT(l.id) FILTER (WHERE l.status = 'pending') AS pending_leads,
    COUNT(l.id) FILTER (WHERE l.status = 'contacted') AS contacted_leads,
    COUNT(l.id) FILTER (WHERE l.status = 'converted') AS converted_leads,
    COUNT(l.id) FILTER (WHERE l.status = 'invalid') AS invalid_leads
FROM batches b
LEFT JOIN leads l ON l.batch_id = b.id
GROUP BY b.id
ORDER BY b.created_at DESC;

-- -----------------------------------------------------------------------------
-- 8. Seed Inicial de Dados (Opcional - para Teste Imediato)
-- -----------------------------------------------------------------------------
-- Inserir Lote Exemplo
INSERT INTO batches (id, name, status, category, interval_seconds)
VALUES ('b1111111-1111-1111-1111-111111111111', 'Prospecção - B2B Clínicas SP', 'active', 'prospecting', 60)
ON CONFLICT (id) DO NOTHING;

-- Inserir Chips de Teste com Proxy JSONB
INSERT INTO agents (id, name, status, provider_id, phone_number, apikey, proxy_info, trust_score, max_messages_per_hour, warming_days)
VALUES 
(
    'a1111111-1111-1111-1111-111111111111', 
    'Instância 01 - SP Alpha', 
    'active', 
    'inst-alpha-01', 
    '+5511987654321', 
    'evo_live_alpha01', 
    '{"enabled": true, "host": "185.199.220.15", "port": "8080", "protocol": "socks5", "username": "prospector_user", "password": "safe_proxy_password"}', 
    94.50, 
    25, 
    30
),
(
    'a2222222-2222-2222-2222-222222222222', 
    'Instância 02 - Maturação', 
    'warming', 
    'inst-warm-02', 
    '+5511977778888', 
    'evo_live_warm02', 
    '{"enabled": true, "host": "proxy.br-residential.net", "port": "3128", "protocol": "http", "username": "evo_client", "password": "pwd_secret_123"}', 
    62.00, 
    15, 
    8
)
ON CONFLICT (id) DO NOTHING;

-- Inserir Templates com Spintax
INSERT INTO message_templates (id, category, title, content, spintax_enabled, batch_id, batch_name)
VALUES 
(
    't1111111-1111-1111-1111-111111111111',
    'prospecting',
    'Abordagem B2B Consultórios',
    '{Olá|Oi|Tudo bem?}, {{name}}! Vi que você atua em {{city}}. {Gostaria de apresentar nossa solução|Temos uma oportunidade rápida|Posso te enviar um resumo de 1 minuto?}',
    true,
    'b1111111-1111-1111-1111-111111111111',
    'Prospecção - B2B Clínicas SP'
),
(
    't2222222-2222-2222-2222-222222222222',
    'warming',
    'Maturação Mútua entre Chips',
    '{E aí|Fala mestre|Oi parceiro}, {tudo certo por aí?|como estão as coisas?|conseguiu ver aquele arquivo?} {Abraço!|Valeu!|Depois me chama!}',
    true,
    NULL,
    'Esteira de Aquecimento'
)
ON CONFLICT (id) DO NOTHING;

-- Inserir Leads de Teste
INSERT INTO leads (id, name, city, phone, whatsapp, rating, batch_id, status, source)
VALUES
(
    'l1111111-1111-1111-1111-111111111111',
    'Dr. Carlos Eduardo',
    'São Paulo',
    '+55 (11) 98765-4321',
    '+5511987654321',
    4.9,
    'b1111111-1111-1111-1111-111111111111',
    'pending',
    'google_maps'
),
(
    'l2222222-2222-2222-2222-222222222222',
    'Dra. Mariana Souza',
    'Campinas',
    '+55 (19) 99888-7766',
    '+5519998887766',
    5.0,
    'b1111111-1111-1111-1111-111111111111',
    'pending',
    'google_maps'
)
ON CONFLICT (id) DO NOTHING;
