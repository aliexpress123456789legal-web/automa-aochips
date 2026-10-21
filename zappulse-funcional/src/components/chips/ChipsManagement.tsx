import React, { useState } from 'react';
import { AgentChip, ChipStatus } from '../../types';
import {
  Smartphone,
  CheckCircle2,
  Flame,
  AlertOctagon,
  PauseCircle,
  Search,
  Trash2,
  Signal,
  ArrowRightCircle,
  Sparkles,
  Network,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  QrCode,
} from 'lucide-react';

interface ChipsManagementProps {
  chips: AgentChip[];
  onUpdateStatus: (chipId: string, newStatus: ChipStatus) => void;
  onDeleteChip: (chipId: string) => void;
  onTestConnection: (chip: AgentChip) => void;
  onOpenAddModal: () => void;
  onOpenEditProxy: (chip: AgentChip) => void;
  onOpenQrCode?: (chip: AgentChip) => void;
}

export const ChipsManagement: React.FC<ChipsManagementProps> = ({
  chips,
  onUpdateStatus,
  onDeleteChip,
  onTestConnection,
  onOpenAddModal,
  onOpenEditProxy,
  onOpenQrCode,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ChipStatus>('all');
  const [chipToDelete, setChipToDelete] = useState<AgentChip | null>(null);

  // Filtered chips
  const filteredChips = chips.filter((chip) => {
    const matchesSearch =
      chip.instanceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chip.phoneNumber.includes(searchTerm) ||
      (chip.deviceInfo && chip.deviceInfo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (chip.proxy?.host && chip.proxy.host.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || chip.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalChips = chips.length;
  const activeChips = chips.filter((c) => c.status === 'active').length;
  const warmingChips = chips.filter((c) => c.status === 'warming').length;
  const bannedChips = chips.filter((c) => c.status === 'banned').length;
  const proxyEnabledChips = chips.filter((c) => c.proxy?.enabled).length;
  const avgTrust =
    totalChips > 0 ? Math.round(chips.reduce((acc, c) => acc + c.trustScore, 0) / totalChips) : 0;

  const getStatusLabel = (status: ChipStatus) => {
    switch (status) {
      case 'active':
        return { label: 'Ativo', color: 'text-emerald-400', icon: CheckCircle2 };
      case 'warming':
        return { label: 'Warming', color: 'text-amber-400', icon: Flame };
      case 'banned':
        return { label: 'Banido / Queda', color: 'text-rose-400', icon: AlertOctagon };
      case 'paused':
        return { label: 'Pausado', color: 'text-slate-400', icon: PauseCircle };
    }
  };

  const getTrustBadgeColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 65) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Top Metric Strip (Single elevation, tabular numerals) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <p className="text-xs text-slate-400">Total de Instâncias</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">{totalChips}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Chips cadastrados</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <p className="text-xs text-slate-400">Chips em Produção</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">{activeChips}</p>
            <span className="text-xs text-slate-500 font-mono">
              ({totalChips ? Math.round((activeChips / totalChips) * 100) : 0}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Disparando campanhas</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <p className="text-xs text-slate-400">Em Maturação (Warming)</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-400 mt-1">{warmingChips}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Aquecendo reputação</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <p className="text-xs text-slate-400">Com Proxy Dedicado</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
              {proxyEnabledChips}
            </p>
            <span className="text-xs text-slate-500 font-mono">
              / {totalChips}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">IPs isolados antiban</p>
        </div>

        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 col-span-2 md:col-span-1">
          <p className="text-xs text-slate-400">Chips Banidos / Caídos</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold font-mono tabular-nums text-rose-400">{bannedChips}</p>
            {bannedChips > 0 && (
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
                Atenção
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Sem proxy / IP compartilhado</p>
        </div>
      </div>

      {/* Proxy Architecture Flow Banner */}
      <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/40 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Network className="w-4 h-4 text-emerald-400" />
            <span>Isolamento por Proxy Individual (/proxy/set) na Evolution API</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Estratégia Antiban Profissional
          </span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto text-[11px] font-mono py-1">
          <span className="px-2 py-1 rounded bg-slate-800 text-slate-200 whitespace-nowrap">
            Dashboard
          </span>
          <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="px-2 py-1 rounded bg-slate-800 text-emerald-300 whitespace-nowrap">
            Sua API
          </span>
          <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="px-2 py-1 rounded bg-slate-800 text-blue-300 whitespace-nowrap">
            Evolution API (/proxy/set)
          </span>
          <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="px-2 py-1 rounded bg-slate-800 text-amber-300 whitespace-nowrap">
            Conexão do Chip
          </span>
          <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="px-2 py-1 rounded bg-slate-800 text-purple-300 whitespace-nowrap">
            Proxy Externo Residencial
          </span>
          <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 whitespace-nowrap">
            Servidores do WhatsApp
          </span>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/30">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por instância, telefone ou proxy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
          />
        </div>

        {/* Segmented Filter Buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({chips.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'active'
                ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ativos ({activeChips})
          </button>
          <button
            onClick={() => setStatusFilter('warming')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'warming'
                ? 'bg-amber-500/20 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Warming ({warmingChips})
          </button>
          <button
            onClick={() => setStatusFilter('banned')}
            className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              statusFilter === 'banned'
                ? 'bg-rose-500/20 text-rose-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Banidos ({bannedChips})
          </button>
        </div>
      </div>

      {/* Chips Table with dedicated Proxy column */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Instância / Perfil</th>
                <th className="py-3 px-4">Número WhatsApp</th>
                <th className="py-3 px-4">Status Atual</th>
                <th className="py-3 px-4">Configuração de Proxy</th>
                <th className="py-3 px-4">Trust Score</th>
                <th className="py-3 px-4 text-right">Cadência</th>
                <th className="py-3 px-4 text-center">Maturação</th>
                <th className="py-3 px-4 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredChips.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-500/10">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <p className="text-base font-semibold text-slate-100">Nenhum chip conectado ainda</p>
                    <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                      Para conectar seu WhatsApp via QR Code na Evolution API, cadastre a instância e escaneie com seu celular.
                    </p>
                    <div className="flex items-center justify-center gap-3 mt-5">
                      <button
                        onClick={onOpenAddModal}
                        className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95"
                      >
                        <QrCode className="w-4 h-4 stroke-[2.5]" />
                        <span>Aperte Aqui: Conectar WhatsApp (QR Code)</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredChips.map((chip) => {
                  const statusInfo = getStatusLabel(chip.status);
                  const isWarmingReady = chip.status === 'warming' && chip.warmingDays >= chip.warmingTargetDays;
                  const hasProxy = chip.proxy && chip.proxy.enabled && chip.proxy.host;

                  return (
                    <tr
                      key={chip.id}
                      className="hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Instance Name & Device */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 shrink-0">
                            <Smartphone className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-200 truncate flex items-center gap-1.5">
                              <span>{chip.instanceName}</span>
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                  chip.connection === 'open'
                                    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                                    : chip.connection === 'connecting'
                                    ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                                    : 'text-rose-300 border-rose-500/30 bg-rose-500/10'
                                }`}
                              >
                                {chip.connection === 'open'
                                  ? 'online'
                                  : chip.connection === 'connecting'
                                  ? 'conectando'
                                  : 'desconectado'}
                              </span>
                            </div>
                            <div
                              className="text-[11px] text-slate-400 truncate max-w-[260px]"
                              title={chip.connectionError || chip.deviceInfo}
                            >
                              {chip.connection !== 'open' && chip.connectionError
                                ? chip.connectionError
                                : chip.deviceInfo || chip.provider}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone Number */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-slate-300 font-medium whitespace-nowrap">
                        {chip.phoneNumber}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 font-medium ${statusInfo.color}`}>
                            {React.createElement(statusInfo.icon, { className: 'w-3.5 h-3.5 shrink-0' })}
                            <span>{statusInfo.label}</span>
                          </span>
                        </div>
                      </td>

                      {/* Proxy Column */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {hasProxy ? (
                          <div className="flex items-center gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-300 font-medium">
                                <span className="uppercase">{chip.proxy?.protocol}</span>
                                <span>·</span>
                                <span className="truncate max-w-[130px]">{chip.proxy?.host}:{chip.proxy?.port}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[170px]">
                                {chip.proxy?.externalIp || 'IP Dedicado Ativo'}
                              </div>
                            </div>
                            <button
                              onClick={() => onOpenEditProxy(chip)}
                              className="p-1 text-slate-400 hover:text-emerald-300 rounded hover:bg-slate-800 transition-colors shrink-0"
                              title="Editar configurações de proxy deste chip"
                            >
                              <Network className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">
                              IP Direto (Sem Proxy)
                            </span>
                            <button
                              onClick={() => onOpenEditProxy(chip)}
                              className="px-1.5 py-0.5 text-[10px] rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-colors"
                            >
                              + Configurar
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Trust Score */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-14 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                chip.trustScore >= 80
                                  ? 'bg-emerald-400'
                                  : chip.trustScore >= 60
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                              }`}
                              style={{ width: `${chip.trustScore}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono tabular-nums font-semibold text-xs px-1.5 py-0.5 rounded border ${getTrustBadgeColor(
                              chip.trustScore
                            )}`}
                          >
                            {chip.trustScore}%
                          </span>
                        </div>
                      </td>

                      {/* Msgs / Hour */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-mono tabular-nums text-slate-200 font-medium">
                          {chip.msgsPerHour}
                        </span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          / {chip.maxMsgsPerHour}h
                        </span>
                      </td>

                      {/* Warming Progress */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {chip.status === 'warming' ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-mono tabular-nums text-amber-300 font-medium">
                              {chip.warmingDays}d
                            </span>
                            <span className="text-slate-500 font-mono text-[11px]">/ {chip.warmingTargetDays}d</span>
                            {isWarmingReady && (
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded font-medium">
                                Pronto!
                              </span>
                            )}
                          </div>
                        ) : chip.status === 'active' ? (
                          <span className="text-slate-400 text-[11px]">Maturado ({chip.warmingDays}d)</span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* QR Code Evolution API button */}
                          <button
                            onClick={() => onOpenQrCode && onOpenQrCode(chip)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors flex items-center gap-1.5 shrink-0"
                            title="Conectar WhatsApp via QR Code"
                          >
                            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                            <span>QR Code</span>
                          </button>

                          {/* Proxy Config button */}
                          <button
                            onClick={() => onOpenEditProxy(chip)}
                            className="p-1 text-slate-400 hover:text-emerald-300 rounded hover:bg-slate-800 transition-colors"
                            title="Editar Proxy"
                          >
                            <Network className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick promote from warming to active */}
                          {chip.status === 'warming' && (
                            <button
                              onClick={() => onUpdateStatus(chip.id, 'active')}
                              className="px-2 py-1 text-[11px] font-medium rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors flex items-center gap-1"
                              title="Promover chip para Ativo"
                            >
                              <ArrowRightCircle className="w-3 h-3" />
                              <span>Ativar</span>
                            </button>
                          )}

                          {chip.status === 'active' && (
                            <button
                              onClick={() => onUpdateStatus(chip.id, 'warming')}
                              className="px-2 py-1 text-[11px] font-medium rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1"
                              title="Recolocar em modo warming para recuperar reputação"
                            >
                              <Flame className="w-3 h-3" />
                              <span>Warming</span>
                            </button>
                          )}

                          {chip.status === 'banned' && (
                            <button
                              onClick={() => onUpdateStatus(chip.id, 'warming')}
                              className="px-2 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                              title="Reiniciar em warming após troca de chip"
                            >
                              Reativar
                            </button>
                          )}

                          {/* Ping connection */}
                          <button
                            onClick={() => onTestConnection(chip)}
                            className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition-colors"
                            title="Testar ping na Evolution API"
                          >
                            <Signal className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setChipToDelete(chip)}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors"
                            title="Remover chip"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {chipToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 shadow-2xl">
            <h4 className="text-sm font-semibold text-white">Confirmar exclusão de instância</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Você tem certeza que deseja remover o chip <strong className="text-slate-200">{chipToDelete.instanceName}</strong> ({chipToDelete.phoneNumber})? Essa ação desvinculará os lotes associados a ele.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setChipToDelete(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteChip(chipToDelete.id);
                  setChipToDelete(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors"
              >
                Sim, Remover Chip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Antiban Advice Tip Box */}
      <div className="p-4 rounded-xl border border-slate-800/80 bg-slate-900/30 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">Regra de Ouro Antiban da Esteira ZapPulse:</p>
          <p>
            Atribua um <strong>Proxy Residencial ou IPv4 Dedicado</strong> exclusivo para cada chip. Quando múltiplos números compartilham o mesmo IP do datacenter da VPS, um banimento em uma conta contamina e derruba todas as outras instâncias conectadas.
          </p>
        </div>
      </div>
    </div>
  );
};
