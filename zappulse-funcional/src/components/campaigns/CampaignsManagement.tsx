import React, { useState } from 'react';
import { Batch, Template, Lead, AgentChip, CampaignStatus } from '../../types';
import { TemplateEditor } from './TemplateEditor';
import { LeadUploader } from './LeadUploader';
import {
  Layers,
  FileText,
  UploadCloud,
  Play,
  Pause,
  Trash2,
  Plus,
  Zap,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Smartphone,
} from 'lucide-react';

interface CampaignsManagementProps {
  batches: Batch[];
  templates: Template[];
  chips: AgentChip[];
  leads: Lead[];
  onToggleBatchStatus: (batchId: string) => void;
  onDeleteBatch: (batchId: string) => void;
  onSaveTemplate: (template: Template) => void;
  onDeleteTemplate: (templateId: string) => void;
  onImportLeads: (batchId: string, leads: Omit<Lead, 'id'>[]) => void;
  onOpenCreateBatch: () => void;
  onTriggerSingleDispatch: (batchId: string) => void;
}

type CampaignSubTab = 'batches' | 'templates' | 'uploader';

export const CampaignsManagement: React.FC<CampaignsManagementProps> = ({
  batches,
  templates,
  chips,
  leads,
  onToggleBatchStatus,
  onDeleteBatch,
  onSaveTemplate,
  onDeleteTemplate,
  onImportLeads,
  onOpenCreateBatch,
  onTriggerSingleDispatch,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<CampaignSubTab>('batches');
  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs (Interactive filter controls) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/60 rounded-lg border border-slate-800/80">
          <button
            onClick={() => setActiveSubTab('batches')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'batches'
                ? 'bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Lotes de Disparo ({batches.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('templates')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'templates'
                ? 'bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Editor & Spintax ({templates.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('uploader')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'uploader'
                ? 'bg-emerald-500/10 text-emerald-300 font-semibold border border-emerald-500/20 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Importador de Leads (CSV)</span>
          </button>
        </div>

        {activeSubTab === 'batches' && (
          <button
            onClick={onOpenCreateBatch}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar Lote</span>
          </button>
        )}
      </div>

      {/* Subtab 1: Batches List */}
      {activeSubTab === 'batches' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <p className="text-xs text-slate-400">Total de Lotes</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                {batches.length}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {batches.filter((b) => b.status === 'active').length} em disparo ativo
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <p className="text-xs text-slate-400">Leads Carregados nos Lotes</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                {batches.reduce((acc, b) => acc + b.totalLeads, 0).toLocaleString('pt-BR')}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {batches.reduce((acc, b) => acc + b.sentCount, 0).toLocaleString('pt-BR')} mensagens disparadas
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
              <p className="text-xs text-slate-400">Taxa de Resposta dos Lotes</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-2xl font-bold font-mono tabular-nums text-slate-200">
                  {batches.reduce((acc, b) => acc + b.sentCount, 0) > 0
                    ? (
                        (batches.reduce((acc, b) => acc + b.repliedCount, 0) /
                          batches.reduce((acc, b) => acc + b.sentCount, 0)) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
                <span className="text-xs text-slate-500 font-mono">
                  ({batches.reduce((acc, b) => acc + b.repliedCount, 0)} respostas)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Média geral da operação</p>
            </div>
          </div>

          {/* Batches Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Nome do Lote / Categoria</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Template Vinculado</th>
                    <th className="py-3 px-4">Chips Vinculados</th>
                    <th className="py-3 px-4">Progresso de Envios</th>
                    <th className="py-3 px-4 text-center">Cadência</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <Layers className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                        <p className="text-sm font-medium text-slate-400">Nenhum lote criado</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Crie um novo lote para começar a disparar suas campanhas.
                        </p>
                        <button
                          onClick={onOpenCreateBatch}
                          className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                        >
                          + Criar Primeiro Lote
                        </button>
                      </td>
                    </tr>
                  ) : (
                    batches.map((batch) => {
                      const template = templates.find((t) => t.id === batch.templateId);
                      const progressPct =
                        batch.totalLeads > 0
                          ? Math.min(100, Math.round((batch.sentCount / batch.totalLeads) * 100))
                          : 0;

                      const assignedChips = chips.filter((c) =>
                        batch.assignedChipIds.includes(c.id)
                      );

                      return (
                        <tr
                          key={batch.id}
                          className="hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-white">{batch.name}</div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                              <span className="capitalize">{batch.category}</span>
                              <span>·</span>
                              <span>{batch.totalLeads} leads totais</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {batch.status === 'active' ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span>Ativo (Disparando)</span>
                              </span>
                            ) : batch.status === 'paused' ? (
                              <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <span>Pausado</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-slate-400 font-medium">
                                <span className="w-2 h-2 rounded-full bg-slate-500" />
                                <span>Concluído</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="font-medium text-slate-300 truncate">
                              {template?.title || 'Template Padrão'}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono truncate">
                              {template?.content.slice(0, 40)}...
                            </p>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1 flex-wrap">
                              {assignedChips.length > 0 ? (
                                assignedChips.map((c) => (
                                  <span
                                    key={c.id}
                                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/80"
                                    title={c.phoneNumber}
                                  >
                                    {c.instanceName}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-500">Nenhum chip</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 min-w-[180px]">
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="font-mono tabular-nums text-slate-300">
                                {batch.sentCount} / {batch.totalLeads} ({progressPct}%)
                              </span>
                              <span className="font-mono text-emerald-400">
                                {batch.repliedCount} respostas
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono tabular-nums text-slate-300">
                            {batch.intervalSeconds}s
                          </td>

                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Single dispatch button for testing */}
                              <button
                                onClick={() => onTriggerSingleDispatch(batch.id)}
                                className="px-2 py-1 text-[11px] font-medium rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors flex items-center gap-1"
                                title="Disparar 1 mensagem deste lote imediatamente"
                              >
                                <Zap className="w-3 h-3" />
                                <span>Disparar 1</span>
                              </button>

                              {/* Toggle active / pause */}
                              <button
                                onClick={() => onToggleBatchStatus(batch.id)}
                                className={`p-1.5 rounded transition-colors ${
                                  batch.status === 'active'
                                    ? 'text-amber-400 hover:bg-amber-500/10'
                                    : 'text-emerald-400 hover:bg-emerald-500/10'
                                }`}
                                title={batch.status === 'active' ? 'Pausar disparos' : 'Retomar disparos'}
                              >
                                {batch.status === 'active' ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => setBatchToDelete(batch)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors"
                                title="Excluir Lote"
                              >
                                <Trash2 className="w-4 h-4" />
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
        </div>
      )}

      {/* Subtab 2: Templates & Spintax Editor */}
      {activeSubTab === 'templates' && (
        <TemplateEditor
          templates={templates}
          onSaveTemplate={onSaveTemplate}
          onDeleteTemplate={onDeleteTemplate}
        />
      )}

      {/* Subtab 3: CSV Leads Uploader */}
      {activeSubTab === 'uploader' && (
        <LeadUploader
          batches={batches}
          onImportLeads={onImportLeads}
          onOpenCreateBatch={onOpenCreateBatch}
        />
      )}

      {/* Delete Batch Confirmation Modal */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-5 shadow-2xl">
            <h4 className="text-sm font-semibold text-white">Excluir Lote de Campanha</h4>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Deseja remover o lote <strong className="text-slate-200">{batchToDelete.name}</strong>? Os leads e métricas associadas serão desvinculados.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setBatchToDelete(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onDeleteBatch(batchToDelete.id);
                  setBatchToDelete(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors"
              >
                Excluir Lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
