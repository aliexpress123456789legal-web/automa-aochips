import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Play,
  Terminal,
  Download,
  FileCode,
  Flame,
  Zap,
  Layers,
  Inbox,
  Sparkles,
} from 'lucide-react';
import { DbStatus } from '../../db/postgres';

interface PostgresModalProps {
  isOpen: boolean;
  onClose: () => void;
  dbStatus: DbStatus | null;
  onRefreshStatus: () => Promise<void>;
  onConnect: (connectionString: string) => Promise<boolean>;
  onRunMigration: () => Promise<boolean>;
  onRunWorkerCycle: () => Promise<{ success: boolean; logs: string[] }>;
}

export const PostgresModal: React.FC<PostgresModalProps> = ({
  isOpen,
  onClose,
  dbStatus,
  onRefreshStatus,
  onConnect,
  onRunMigration,
  onRunWorkerCycle,
}) => {
  const [activeTab, setActiveTab] = useState<'connection' | 'worker' | 'ddl'>('connection');
  const [ddlSubTab, setDdlSubTab] = useState<'schema' | 'seed' | 'worker_queries'>('schema');
  const [connString, setConnString] = useState('postgresql://postgres:postgres@localhost:5432/zappulse');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Worker execution state
  const [isRunningWorker, setIsRunningWorker] = useState(false);
  const [workerLogs, setWorkerLogs] = useState<string[]>([
    'ℹ️ O Worker de Disparo monitora as tabelas do PostgreSQL continuamente.',
    'Clique em "Executar Ciclo do Worker Agora" para processar a fila em tempo real.',
  ]);

  useEffect(() => {
    if (isOpen) {
      onRefreshStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connString.trim()) return;
    setIsConnecting(true);
    await onConnect(connString.trim());
    setIsConnecting(false);
  };

  const handleMigrate = async () => {
    setIsMigrating(true);
    await onRunMigration();
    setIsMigrating(false);
    await onRefreshStatus();
  };

  const handleExecuteWorker = async () => {
    setIsRunningWorker(true);
    const result = await onRunWorkerCycle();
    if (result.logs) {
      setWorkerLogs((prev) => [...result.logs, ...prev.slice(0, 15)]);
    }
    setIsRunningWorker(false);
    await onRefreshStatus();
  };

  const fullSchemaScript = `-- =============================================================================
-- ZAPPULSE - POSTGRESQL DDL COMPLETO (ENUMs, UUIDs, JSONB & RELACIONAMENTOS)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 0. Tipos Enumerados (ENUMs) para consistência de dados
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

-- 1. Tabela: batches (Lotes de Campanha)
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

-- 2. Tabela: agents (Chips / Instâncias WhatsApp)
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    status agent_status_enum NOT NULL DEFAULT 'new',
    provider_id VARCHAR(100),               -- Identificador da sessão/instância (Evolution API)
    phone_number VARCHAR(30),               -- Ex: +5511999999999
    apikey VARCHAR(255),
    proxy_info JSONB,                       -- {enabled, host, port, username, password, protocol}
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

-- 3. Tabela: leads (Contatos a prospectar)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100),
    phone VARCHAR(30),
    rating NUMERIC(3, 2) CHECK (rating >= 0 AND rating <= 5.0),
    whatsapp VARCHAR(30),                   -- Formato E.164 (+5511999999999)
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

-- 4. Tabela: message_templates (Templates com Spintax)
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

-- 5. Tabela: logs_communication (Histórico de Disparos do Worker)
CREATE TABLE IF NOT EXISTS logs_communication (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES agents (id) ON DELETE RESTRICT,
    receiver_id UUID NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
    message_id UUID REFERENCES message_templates (id) ON DELETE SET NULL,
    status communication_status_enum NOT NULL DEFAULT 'queued',
    sent_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,
    payload JSONB
);

CREATE INDEX IF NOT EXISTS idx_logs_sender_id ON logs_communication (sender_id);
CREATE INDEX IF NOT EXISTS idx_logs_receiver_id ON logs_communication (receiver_id);
CREATE INDEX IF NOT EXISTS idx_logs_status_sent_at ON logs_communication (status, sent_at DESC);

-- 6. Tabela: lead_responses (Inbox de Respostas Recebidas)
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
CREATE INDEX IF NOT EXISTS idx_lead_responses_batch_id ON lead_responses (batch_id);`;

  const seedScript = `-- =============================================================================
-- SEED DE DADOS INICIAIS DE TESTE (EXECUTE APÓS O DDL)
-- =============================================================================

-- Inserir Lote de Campanha
INSERT INTO batches (id, name, status, category, interval_seconds)
VALUES ('b1111111-1111-1111-1111-111111111111', 'Prospecção - B2B Clínicas SP', 'active', 'prospecting', 60)
ON CONFLICT (id) DO NOTHING;

-- Inserir Chips (Agentes) com Proxy JSONB
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

-- Inserir Leads Pendentes
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
ON CONFLICT (id) DO NOTHING;`;

  const workerQueriesScript = `-- =============================================================================
-- QUERIES OTIMIZADAS PARA O MOTOR DE DISPARO (WORKER NODE.JS)
-- =============================================================================

-- 1. Buscar chips disponíveis para prospecção (ativos com trust score seguro)
SELECT id, name, provider_id, phone_number, max_messages_per_hour, trust_score, proxy_info
FROM agents 
WHERE status = 'active' AND trust_score >= 60.00
ORDER BY total_sent ASC;

-- 2. Buscar próximo lead da fila de um lote ativo com bloqueio de concorrência (SKIP LOCKED)
SELECT l.id, l.name, l.city, l.phone, l.whatsapp, l.batch_id, b.interval_seconds
FROM leads l
JOIN batches b ON b.id = l.batch_id
WHERE b.status = 'active' AND l.status = 'pending'
ORDER BY l.created_at ASC
FOR UPDATE SKIP LOCKED
LIMIT 1;

-- 3. Atualizar lead para 'contacted' e registrar no log de comunicação em transação única
BEGIN;
  UPDATE leads 
  SET status = 'contacted', sent_at = NOW(), agent_id = 'a1111111-1111-1111-1111-111111111111'
  WHERE id = 'l1111111-1111-1111-1111-111111111111';

  UPDATE agents 
  SET total_sent = total_sent + 1, updated_at = NOW() 
  WHERE id = 'a1111111-1111-1111-1111-111111111111';

  INSERT INTO logs_communication (sender_id, receiver_id, message_id, status)
  VALUES ('a1111111-1111-1111-1111-111111111111', 'l1111111-1111-1111-1111-111111111111', 't1111111-1111-1111-1111-111111111111', 'sent');
COMMIT;

-- 4. Rotina de Warming: Agentes em maturação para troca de mensagens mútua
SELECT id, name, provider_id, trust_score, warming_days 
FROM agents 
WHERE status = 'warming'
ORDER BY trust_score ASC;`;

  const getCurrentSqlText = () => {
    if (ddlSubTab === 'schema') return fullSchemaScript;
    if (ddlSubTab === 'seed') return seedScript;
    return workerQueriesScript;
  };

  const handleCopyCurrentSql = () => {
    navigator.clipboard.writeText(getCurrentSqlText());
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const handleDownloadSql = () => {
    const blob = new Blob([getCurrentSqlText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = ddlSubTab === 'schema' ? 'zappulse-schema.sql' : ddlSubTab === 'seed' ? 'zappulse-seed.sql' : 'zappulse-worker-queries.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isConnected = dbStatus?.connected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Integração PostgreSQL & Worker</h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium border ${
                    isConnected
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  }`}
                >
                  {isConnected ? `Online (${dbStatus.latencyMs}ms)` : 'Modo Local / Demo'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sincronização em tempo real das tabelas: <code className="text-emerald-400">agents</code>, <code className="text-emerald-400">leads</code>, <code className="text-emerald-400">batches</code>, <code className="text-emerald-400">message_templates</code>, <code className="text-emerald-400">logs_communication</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800/80 text-xs shrink-0">
          <button
            onClick={() => setActiveTab('connection')}
            className={`pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'connection'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Conexão & Status</span>
          </button>

          <button
            onClick={() => setActiveTab('ddl')}
            className={`pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'ddl'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>PostgreSQL SQL (DDL & Seed)</span>
          </button>

          <button
            onClick={() => setActiveTab('worker')}
            className={`pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'worker'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Motor de Disparo (Worker)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* TAB 1: CONNECTION */}
          {activeTab === 'connection' && (
            <div className="space-y-4">
              {/* Connection Form */}
              <form onSubmit={handleConnect} className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    String de Conexão PostgreSQL (URI)
                  </label>
                  <input
                    type="text"
                    value={connString}
                    onChange={(e) => setConnString(e.target.value)}
                    placeholder="postgresql://usuario:senha@localhost:5432/seu_banco"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-800 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Compatível com Docker, Supabase, Neon, AWS RDS, GCP Cloud SQL, VPS ou PostgreSQL local.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onRefreshStatus}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded bg-slate-900 border border-slate-800 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Checar Conexão</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isMigrating}
                      onClick={handleMigrate}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                      title="Executa CREATE TYPE, CREATE TABLE, INDEXES no banco conectado"
                    >
                      {isMigrating ? 'Criando tabelas...' : 'Executar DDL / Criar Tabelas'}
                    </button>

                    <button
                      type="submit"
                      disabled={isConnecting}
                      className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
                    >
                      <span>{isConnecting ? 'Conectando...' : 'Conectar ao PostgreSQL'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Table counts grid if connected */}
              {isConnected && dbStatus.tableCounts && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Contagem de Registros nas Tabelas do Banco
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-950">
                      <span className="text-[11px] text-slate-400 block">Tabela <code className="text-emerald-400">agents</code></span>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        {dbStatus.tableCounts.agents}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-950">
                      <span className="text-[11px] text-slate-400 block">Tabela <code className="text-blue-400">batches</code></span>
                      <span className="text-lg font-bold font-mono text-blue-400">
                        {dbStatus.tableCounts.batches}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-950">
                      <span className="text-[11px] text-slate-400 block">Tabela <code className="text-indigo-400">leads</code></span>
                      <span className="text-lg font-bold font-mono text-indigo-400">
                        {dbStatus.tableCounts.leads}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-950">
                      <span className="text-[11px] text-slate-400 block">Tabela <code className="text-amber-400">templates</code></span>
                      <span className="text-lg font-bold font-mono text-amber-400">
                        {dbStatus.tableCounts.message_templates}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-950">
                      <span className="text-[11px] text-slate-400 block">Tabela <code className="text-purple-400">logs_communication</code></span>
                      <span className="text-lg font-bold font-mono text-purple-400">
                        {dbStatus.tableCounts.logs_communication}
                      </span>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-800 bg-slate-950">
                      <span className="text-[11px] text-slate-400 block">Tabela <code className="text-teal-400">lead_responses</code></span>
                      <span className="text-lg font-bold font-mono text-teal-400">
                        {dbStatus.tableCounts.lead_responses}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tips */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-xs text-slate-400 space-y-1">
                <span className="font-semibold text-slate-200">Como funciona a arquitetura:</span>
                <p className="text-[11px]">
                  O Front-end do ZapPulse escreve diretamente nessas tabelas do PostgreSQL via API local. O seu <strong>worker.ts</strong> (motor de disparo) pode rodar no mesmo servidor ou em background lendo as tabelas <code className="text-emerald-400">leads</code> e <code className="text-emerald-400">agents</code> para efetuar os disparos na Evolution API.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: DDL SQL SCRIPT */}
          {activeTab === 'ddl' && (
            <div className="space-y-3">
              {/* Selector between schema, seed and queries */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                  <button
                    onClick={() => setDdlSubTab('schema')}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                      ddlSubTab === 'schema'
                        ? 'bg-slate-800 text-emerald-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    1. DDL Completo (Tabelas + ENUMs)
                  </button>
                  <button
                    onClick={() => setDdlSubTab('seed')}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                      ddlSubTab === 'seed'
                        ? 'bg-slate-800 text-emerald-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    2. Seed Inicial de Dados
                  </button>
                  <button
                    onClick={() => setDdlSubTab('worker_queries')}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                      ddlSubTab === 'worker_queries'
                        ? 'bg-slate-800 text-emerald-400'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    3. Queries para o Worker
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleDownloadSql}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .sql</span>
                  </button>

                  <button
                    onClick={handleCopyCurrentSql}
                    className="px-2.5 py-1 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition-colors"
                  >
                    {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
                  </button>
                </div>
              </div>

              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto leading-relaxed max-h-80 select-all">
                {getCurrentSqlText()}
              </pre>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>
                  💡 Você pode colar este SQL diretamente no DBeaver, pgAdmin, terminal <code className="text-slate-300">psql</code> ou painel do Supabase / Neon.
                </span>
                {isConnected && (
                  <button
                    onClick={handleMigrate}
                    className="text-emerald-400 hover:underline font-medium"
                  >
                    Rodar agora no banco conectado
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: WORKER REAL-TIME ENGINE */}
          {activeTab === 'worker' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Motor de Disparo & Esteira de Maturação</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Executa as rotinas de <strong className="text-slate-300">WarmingWorker</strong> e <strong className="text-slate-300">ProspectingEngine</strong> nas tabelas do PostgreSQL.
                    </p>
                  </div>

                  <button
                    onClick={handleExecuteWorker}
                    disabled={isRunningWorker}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 whitespace-nowrap self-start sm:self-auto"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isRunningWorker ? 'Processando Fila...' : 'Executar Ciclo do Worker Agora'}</span>
                  </button>
                </div>

                {/* Worker Execution Logs Terminal */}
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] space-y-1.5 max-h-52 overflow-y-auto">
                  <div className="text-slate-500 text-[10px] pb-1 border-b border-slate-800 flex items-center justify-between">
                    <span>Console de Execução do Worker</span>
                    <span className="text-emerald-400">Node.js + pg.Pool</span>
                  </div>
                  {workerLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={
                        log.includes('✅')
                          ? 'text-emerald-300'
                          : log.includes('❌')
                          ? 'text-rose-400'
                          : log.includes('⚠️')
                          ? 'text-amber-300'
                          : 'text-slate-300'
                      }
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              {/* Schema mapping explanation */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-xs text-slate-400 space-y-1.5">
                <span className="font-semibold text-slate-200">Como o Worker processa os dados do Dashboard:</span>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>
                    <strong>WarmingWorker:</strong> consulta <code className="text-emerald-400">agents WHERE status = 'warming'</code> e <code className="text-emerald-400">message_templates WHERE category = 'warming'</code>, sorteia pares e incrementa o <code className="text-emerald-400">trust_score</code>.
                  </li>
                  <li>
                    <strong>ProspectingEngine:</strong> consulta <code className="text-emerald-400">batches WHERE status = 'active'</code> e consome <code className="text-emerald-400">leads WHERE status = 'pending'</code>, respeitando o <code className="text-emerald-400">max_messages_per_hour</code> de cada chip via Round-Robin.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
