import React from 'react';
import { Smartphone, Layers, Activity, Inbox, MessageSquareShare, ShieldAlert, Sparkles, Radio } from 'lucide-react';

export type NavigationTab = 'chips' | 'campaigns' | 'health' | 'inbox';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  unreadResponsesCount: number;
  activeChipsCount: number;
  bannedChipsCount: number;
  isEvolutionConnected?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  unreadResponsesCount,
  activeChipsCount,
  bannedChipsCount,
  isEvolutionConnected,
}) => {
  const navItems = [
    {
      id: 'chips' as NavigationTab,
      label: 'Gestão de Agentes',
      subtitle: 'Chips, Proxies & Warming',
      icon: Smartphone,
      badge: `${activeChipsCount} ativos`,
      alert: bannedChipsCount > 0 ? `${bannedChipsCount} banido` : undefined,
    },
    {
      id: 'campaigns' as NavigationTab,
      label: 'Gestão de Campanhas',
      subtitle: 'Lotes, Leads & Spintax',
      icon: Layers,
    },
    {
      id: 'health' as NavigationTab,
      label: 'Monitor de Saúde',
      subtitle: 'Telemetria & Antiban',
      icon: Activity,
    },
    {
      id: 'inbox' as NavigationTab,
      label: 'Central de Respostas',
      subtitle: 'Leads Respondendo',
      icon: Inbox,
      highlightBadge: unreadResponsesCount > 0 ? `${unreadResponsesCount} novos` : undefined,
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-col justify-between shrink-0 select-none">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="p-5 pb-2 flex items-center justify-between border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-950/40">
              <MessageSquareShare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white">ZapPulse</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">Evolution Engine</p>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="px-3">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Painel de Controle
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-300 font-medium border border-emerald-500/20'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <div className="truncate">
                      <div className="text-xs truncate">{item.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>
                    </div>
                  </div>

                  {item.highlightBadge && (
                    <span className="text-[10px] font-mono tabular-nums font-semibold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950">
                      {item.highlightBadge}
                    </span>
                  )}
                  {item.alert && (
                    <span className="text-[10px] font-mono tabular-nums font-semibold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {item.alert}
                    </span>
                  )}
                  {!item.highlightBadge && !item.alert && item.badge && (
                    <span className="text-[10px] font-mono tabular-nums text-slate-400">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer System Status */}
      <div className="p-4 border-t border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Radio className={`w-3 h-3 ${isEvolutionConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>Evolution API</span>
          </span>
          <span className={`font-mono ${isEvolutionConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isEvolutionConnected ? 'Conectado' : 'Aguardando Config'}
          </span>
        </div>
      </div>
    </aside>
  );
};
