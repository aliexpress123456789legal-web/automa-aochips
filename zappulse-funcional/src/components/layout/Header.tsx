import React from 'react';
import { NavigationTab } from './Sidebar';
import { Plus, Webhook, Zap, Database, Radio, QrCode, Settings } from 'lucide-react';
import { DbStatus } from '../../db/postgres';

interface HeaderProps {
  currentTab: NavigationTab;
  onOpenAddChip?: () => void;
  onOpenNewBatch?: () => void;
  onOpenWebhookModal?: () => void;
  onOpenPostgresModal?: () => void;
  onOpenEvolutionModal?: () => void;
  onOpenSettings?: () => void;
  workerOn?: boolean;
  isEvolutionConnected?: boolean;
  onTriggerBatchDispatch?: () => void;
  dbStatus?: DbStatus | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenAddChip,
  onOpenNewBatch,
  onOpenWebhookModal,
  onOpenPostgresModal,
  onOpenEvolutionModal,
  onOpenSettings,
  workerOn,
  isEvolutionConnected,
  onTriggerBatchDispatch,
  dbStatus,
}) => {
  const titles: Record<NavigationTab, { section: string; current: string; desc: string }> = {
    chips: {
      section: 'Gestão de Instâncias',
      current: 'Chips & Maturação',
      desc: 'Supervisão de chips conectados, trust score, velocidade horária e esteira de aquecimento.',
    },
    campaigns: {
      section: 'Disparos em Massa',
      current: 'Campanhas & Templates',
      desc: 'Gestão de lotes, importação de leads via CSV e editor de spintax dinâmico antiban.',
    },
    health: {
      section: 'Telemetria & Segurança',
      current: 'Monitor de Saúde Antiban',
      desc: 'Indicadores de maturidade, histórico de disparos 24h e alertas de risco de bloqueio.',
    },
    inbox: {
      section: 'Atendimento & Conversão',
      current: 'Central de Respostas',
      desc: 'Inbox em tempo real com leads respondendo, identificação de intenção e atalho WhatsApp Web.',
    },
  };

  const info = titles[currentTab];

  return (
    <header className="h-16 px-6 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-sm flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Breadcrumb Trail */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400">{info.section}</span>
        <span className="text-slate-600">/</span>
        <span className="font-semibold text-slate-100">{info.current}</span>
      </div>

      {/* Primary Actions based on current tab */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onOpenSettings}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            workerOn
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700/80'
          }`}
          title="Provedor, janela de envio, opt-out e atividade do motor"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>{workerOn ? 'Motor ligado' : 'Motor desligado'}</span>
        </button>

        <button
          onClick={onOpenEvolutionModal}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            isEvolutionConnected
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700/80'
          }`}
          title="Configurar e testar conexão com a Evolution API"
        >
          <Radio className={`w-3.5 h-3.5 ${isEvolutionConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>{isEvolutionConnected ? 'Evolution API (Online)' : 'Evolution API (offline)'}</span>
        </button>

        <button
          onClick={onOpenPostgresModal}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            dbStatus?.connected
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700/80'
          }`}
          title="Postgres opcional (o painel já salva em data/db.json)"
        >
          <Database className={`w-3.5 h-3.5 ${dbStatus?.connected ? 'text-emerald-400' : 'text-slate-400'}`} />
          <span>{dbStatus?.connected ? `Postgres (${dbStatus.database || 'Online'})` : 'Conectar PostgreSQL'}</span>
          {dbStatus?.connected && dbStatus.latencyMs !== undefined && (
            <span className="text-[10px] font-mono opacity-75">· {dbStatus.latencyMs}ms</span>
          )}
        </button>

        <button
          onClick={onOpenWebhookModal}
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Webhook className="w-3.5 h-3.5 text-emerald-400" />
          <span>Webhook</span>
        </button>

        {currentTab === 'chips' && onOpenAddChip && (
          <button
            onClick={onOpenAddChip}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm shadow-emerald-500/20"
            title="Cadastrar chip e abrir QR Code para escanear"
          >
            <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Conectar Chip (QR Code)</span>
          </button>
        )}

        {currentTab === 'campaigns' && onOpenNewBatch && (
          <button
            onClick={onOpenNewBatch}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm shadow-emerald-500/20"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Criar Novo Lote</span>
          </button>
        )}

        {currentTab === 'campaigns' && onTriggerBatchDispatch && (
          <button
            onClick={onTriggerBatchDispatch}
            className="px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Roda um ciclo do worker agora: envia 1 mensagem real do lote ativo"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Disparar 1 agora</span>
          </button>
        )}
      </div>
    </header>
  );
};
