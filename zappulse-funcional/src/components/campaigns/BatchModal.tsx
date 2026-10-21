import React, { useState } from 'react';
import { Batch, Template, AgentChip, CampaignStatus, TemplateCategory } from '../../types';
import { X, Layers, Clock, CheckSquare } from 'lucide-react';

interface BatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  chips: AgentChip[];
  onCreateBatch: (batch: Omit<Batch, 'id' | 'createdAt' | 'sentCount' | 'deliveredCount' | 'repliedCount' | 'failedCount' | 'totalLeads'>) => void;
}

export const BatchModal: React.FC<BatchModalProps> = ({
  isOpen,
  onClose,
  templates,
  chips,
  onCreateBatch,
}) => {
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState(templates[0]?.id || '');
  const [category, setCategory] = useState<TemplateCategory>('prospecting');
  const [status, setStatus] = useState<CampaignStatus>('active');
  const [intervalSeconds, setIntervalSeconds] = useState(65);
  const [selectedChips, setSelectedChips] = useState<string[]>(
    chips.filter((c) => c.status === 'active' || c.status === 'warming').map((c) => c.id).slice(0, 2)
  );

  if (!isOpen) return null;

  const handleToggleChip = (chipId: string) => {
    setSelectedChips((prev) =>
      prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreateBatch({
      name: name.trim(),
      templateId,
      category,
      status,
      intervalSeconds: Number(intervalSeconds) || 60,
      assignedChipIds: selectedChips,
    });

    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Criar Novo Lote de Disparo</h3>
              <p className="text-xs text-slate-400">Defina o nome, template, cadência de envio e chips</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nome do Lote / Campanha
            </label>
            <input
              type="text"
              required
              placeholder="ex: Prospecção B2B Logística - Outubro 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Categoria da Ação
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60"
              >
                <option value="prospecting">Prospecção (Outbound)</option>
                <option value="warming">Maturação (Warming)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Status Inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CampaignStatus)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60"
              >
                <option value="active">Ativo (Inicia Disparos)</option>
                <option value="paused">Pausado (Aguardando)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Template de Mensagem Vinculado
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.title} ({tpl.category.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Intervalo entre Disparos (Segundos)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={30}
                max={300}
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                className="w-32 px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60 font-mono"
              />
              <span className="text-xs text-slate-400">
                segundos de descanso entre cada mensagem (mínimo seguro: 45s)
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Chips / Instâncias Participantes ({selectedChips.length} selecionados)
            </label>
            <div className="max-h-36 overflow-y-auto space-y-1 p-2 rounded-lg bg-slate-950 border border-slate-800">
              {chips.map((chip) => {
                const isSelected = selectedChips.includes(chip.id);
                const isBanned = chip.status === 'banned';

                return (
                  <div
                    key={chip.id}
                    onClick={() => !isBanned && handleToggleChip(chip.id)}
                    className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${
                      isBanned
                        ? 'opacity-40 cursor-not-allowed bg-slate-900'
                        : isSelected
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'hover:bg-slate-900 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && '✓'}
                      </div>
                      <span className="font-medium">{chip.instanceName}</span>
                      <span className="text-slate-500 font-mono text-[11px]">{chip.phoneNumber}</span>
                    </div>
                    <span className="text-[10px] font-mono capitalize text-slate-400">
                      {chip.status} · {chip.trustScore}% trust
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
            >
              <span>Salvar e Criar Lote</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
