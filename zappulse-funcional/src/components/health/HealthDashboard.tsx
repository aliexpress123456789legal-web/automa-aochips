import React from 'react';
import { AgentChip, HourlyTelemetry } from '../../types';
import { HourlyDispatchChart } from './HourlyDispatchChart';
import {
  Activity,
  Smartphone,
  Flame,
  AlertOctagon,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Cpu,
  Clock,
  Zap,
} from 'lucide-react';

interface HealthDashboardProps {
  chips: AgentChip[];
  telemetry: HourlyTelemetry[];
  onPromoteChip: (chipId: string) => void;
  onNavigateToChips: () => void;
}

export const HealthDashboard: React.FC<HealthDashboardProps> = ({
  chips,
  telemetry,
  onPromoteChip,
  onNavigateToChips,
}) => {
  const totalChips = chips.length;
  const activeChips = chips.filter((c) => c.status === 'active');
  const warmingChips = chips.filter((c) => c.status === 'warming');
  const bannedChips = chips.filter((c) => c.status === 'banned');

  const avgTrust =
    totalChips > 0 ? Math.round(chips.reduce((acc, c) => acc + c.trustScore, 0) / totalChips) : 0;

  const totalSentAll = chips.reduce((acc, c) => acc + c.totalSent, 0);
  const totalFailedAll = chips.reduce((acc, c) => acc + c.totalFailed, 0);
  const deliveryRate =
    totalSentAll > 0 ? (((totalSentAll - totalFailedAll) / totalSentAll) * 100).toFixed(1) : '100';

  // Chips ready for promotion (completed warming target days)
  const readyForPromotion = warmingChips.filter((c) => c.warmingDays >= c.warmingTargetDays);

  return (
    <div className="space-y-6">
      {/* 3 Main KPI Cards requested explicitly by the user + 1 trust score KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Chips Conectados */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Chips Conectados</span>
              <Smartphone className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-3xl font-bold font-mono tabular-nums text-white mt-2">
              {activeChips.length}
            </p>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span>Operando normalmente</span>
            <span className="font-mono text-emerald-400">
              {Math.round((activeChips.length / (totalChips || 1)) * 100)}% da frota
            </span>
          </div>
        </div>

        {/* KPI 2: Chips em Maturação */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Chips em Maturação (Warming)</span>
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-3xl font-bold font-mono tabular-nums text-amber-400 mt-2">
              {warmingChips.length}
            </p>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span>{readyForPromotion.length} prontos para ativar</span>
            <span className="font-mono text-amber-400">Esteira Ativa</span>
          </div>
        </div>

        {/* KPI 3: Chips Banidos/Caídos (Alerta Vermelho) */}
        <div className={`p-4 rounded-xl border flex flex-col justify-between transition-colors ${
          bannedChips.length > 0
            ? 'border-rose-500/40 bg-rose-950/20 shadow-lg shadow-rose-950/20'
            : 'border-slate-800 bg-slate-900/50'
        }`}>
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-rose-300">Chips Banidos / Caídos</span>
              <AlertOctagon className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-3xl font-bold font-mono tabular-nums text-rose-400 mt-2">
              {bannedChips.length}
            </p>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between pt-2 border-t border-slate-800/80">
            {bannedChips.length > 0 ? (
              <span className="text-rose-400 font-semibold uppercase tracking-wider">
                Alerta Vermelho: Rotação Necessária
              </span>
            ) : (
              <span className="text-emerald-400">Nenhuma queda recente</span>
            )}
            <span className="font-mono text-slate-400">0% perda de leads</span>
          </div>
        </div>

        {/* KPI 4: Trust Score & Taxa de Entrega */}
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Saúde Geral Antiban</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <p className="text-3xl font-bold font-mono tabular-nums text-slate-100">{avgTrust}%</p>
              <span className="text-xs text-slate-400 font-mono">Score Médio</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span>Taxa de Entrega:</span>
            <span className="font-mono text-emerald-400 font-semibold">{deliveryRate}%</span>
          </div>
        </div>
      </div>

      {/* Hourly Dispatch Chart (Últimas 24 Horas) */}
      <HourlyDispatchChart telemetry={telemetry} />

      {/* Chips at Risk & Ready for Promotion split row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chips prontos para promoção ou em risco */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Oportunidades de Maturação & Promoção</span>
            </h4>
            <button
              onClick={onNavigateToChips}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
            >
              <span>Ver todos os chips</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {warmingChips.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Nenhum chip em warming no momento.
            </p>
          ) : (
            <div className="space-y-2.5">
              {warmingChips.map((chip) => {
                const isReady = chip.warmingDays >= chip.warmingTargetDays;
                return (
                  <div
                    key={chip.id}
                    className="p-3 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">
                          {chip.instanceName}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {chip.phoneNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {chip.warmingDays} de {chip.warmingTargetDays} dias maturados · Trust:{' '}
                        <span className="font-mono text-amber-300 font-semibold">
                          {chip.trustScore}%
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isReady ? (
                        <button
                          onClick={() => onPromoteChip(chip.id)}
                          className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Promover a Ativo</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          Faltam {chip.warmingTargetDays - chip.warmingDays} dias
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Antiban Protection Invariants */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="pb-2 border-b border-slate-800/80">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Diretrizes Ativas de Segurança Antiban</span>
            </h4>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
              <div>
                <p className="font-semibold text-slate-200">Cadência Aleatória com Jitter</p>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  Disparos com intervalo flutuante (ex: 60s ± 25s) para emular digitação humana autêntica na Evolution API.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
              <div>
                <p className="font-semibold text-slate-200">Variação de Spintax Obrigatória</p>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  Evita que o algoritmo do WhatsApp identifique mensagens idênticas disparadas consecutivamente.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />
              <div>
                <p className="font-semibold text-slate-200">Teto Seguro por Chip</p>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  Chips em warming travados em no máximo 15 msgs/hora. Chips ativos limitados a 35 msgs/hora.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
              <div>
                <p className="font-semibold text-slate-200">Descanso Noturno Automático</p>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  Disparos pausados automaticamente entre 21h00 e 07h30 da manhã para respeitar o ciclo biológico do receptor.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
              <div>
                <p className="font-semibold text-slate-200">Isolamento de IP por Proxy (/proxy/set)</p>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  Cada chip deve utilizar um IP dedicado ou residencial individual via Evolution API para blindar a infraestrutura contra banimentos em cascata.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
