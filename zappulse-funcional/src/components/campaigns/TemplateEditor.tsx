import React, { useState } from 'react';
import { Template, TemplateCategory } from '../../types';
import {
  resolveSpintax,
  interpolateVariables,
  calculateSpintaxVariations,
  tokenizeMessage,
} from '../../utils/spintax';
import {
  FileText,
  Sparkles,
  Shuffle,
  ShieldCheck,
  CheckCircle,
  Plus,
  Trash2,
  Copy,
  Flame,
  Target,
} from 'lucide-react';

interface TemplateEditorProps {
  templates: Template[];
  onSaveTemplate: (template: Template) => void;
  onDeleteTemplate: (templateId: string) => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  templates,
  onSaveTemplate,
  onDeleteTemplate,
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    templates[0]?.id || ''
  );
  const [title, setTitle] = useState(templates[0]?.title || '');
  const [category, setCategory] = useState<TemplateCategory>(
    templates[0]?.category || 'prospecting'
  );
  const [content, setContent] = useState(templates[0]?.content || '');
  const [description, setDescription] = useState(templates[0]?.description || '');

  // Sample lead for live simulation
  const [sampleLead, setSampleLead] = useState({
    name: 'Guilherme Costa',
    city: 'Belo Horizonte',
    company: 'Soluções Integradas',
    phone: '+55 (31) 98765-4321',
  });

  const [previewSeed, setPreviewSeed] = useState(0);

  // When changing selected template
  const handleSelectTemplate = (tpl: Template) => {
    setSelectedTemplateId(tpl.id);
    setTitle(tpl.title);
    setCategory(tpl.category);
    setContent(tpl.content);
    setDescription(tpl.description || '');
  };

  const handleCreateNew = () => {
    const newId = 'tpl-' + Date.now().toString(36);
    const newTpl: Template = {
      id: newId,
      title: 'Novo Template de Prospecção',
      category: 'prospecting',
      content: '{Olá|Oi|Bom dia} {{name}}, vi que você atua em {{city}}. {Tudo bem?|Como vão as coisas?}\n\n{Gostaria de apresentar nossa solução rápida.|Podemos bater um papo de 5 minutos sobre tecnologia?}',
      description: 'Template personalizado com variações antiban',
      updatedAt: new Date().toISOString(),
    };
    setSelectedTemplateId(newId);
    setTitle(newTpl.title);
    setCategory(newTpl.category);
    setContent(newTpl.content);
    setDescription(newTpl.description || '');
    onSaveTemplate(newTpl);
  };

  const handleSave = () => {
    if (!title.trim() || !content.trim()) return;

    const tpl: Template = {
      id: selectedTemplateId || 'tpl-' + Date.now().toString(36),
      title: title.trim(),
      category,
      content,
      description: description.trim(),
      updatedAt: new Date().toISOString(),
    };

    onSaveTemplate(tpl);
  };

  const insertSnippet = (snippet: string) => {
    setContent((prev) => prev + snippet);
  };

  // Calculations for spintax metrics
  const variationsCount = calculateSpintaxVariations(content);
  const tokens = tokenizeMessage(content);

  // Generate 3 sample outputs based on current template + sample lead
  const generatedSamples = [0, 1, 2].map((idx) => {
    // using index & previewSeed to trigger re-renders
    void previewSeed;
    void idx;
    // variáveis primeiro, spintax depois (mesma ordem do servidor)
    return resolveSpintax(interpolateVariables(content, { ...sampleLead, first_name: sampleLead.name.split(' ')[0] }));
  });

  const getSafetyLevel = (count: number) => {
    if (count >= 30) return { label: 'Proteção Antiban Excelente', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (count >= 10) return { label: 'Proteção Antiban Moderada', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    return { label: 'Risco de Banimento Alto (Pouca Variação)', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
  };

  const safety = getSafetyLevel(variationsCount);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left List of Templates */}
      <div className="lg:col-span-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Templates Gravados ({templates.length})
          </h4>
          <button
            onClick={handleCreateNew}
            className="px-2.5 py-1 text-xs font-medium rounded-lg text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo</span>
          </button>
        </div>

        <div className="space-y-2">
          {templates.map((tpl) => {
            const isSelected = tpl.id === selectedTemplateId;
            const isWarming = tpl.category === 'warming';

            return (
              <div
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500/50 shadow-md shadow-emerald-500/5'
                    : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{tpl.title}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 font-mono">
                      {tpl.content.slice(0, 85)}...
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                      isWarming
                        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    }`}
                  >
                    {isWarming ? <Flame className="w-2.5 h-2.5" /> : <Target className="w-2.5 h-2.5" />}
                    <span>{isWarming ? 'Warming' : 'Prospecting'}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center/Right: Template Editor & Live Spintax Tester */}
      <div className="lg:col-span-8 space-y-5">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>Editor de Mensagem com Spintax Dinâmico</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Utilize blocos <code className="text-emerald-400">{"{Olá|Oi|Bom dia}"}</code> para alternar palavras e evitar filtros do WhatsApp.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {templates.length > 1 && selectedTemplateId && (
                <button
                  onClick={() => onDeleteTemplate(selectedTemplateId)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Excluir este template"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleSave}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Salvar Template</span>
              </button>
            </div>
          </div>

          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nome do Template
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex: Abordagem Decisores TI"
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Finalidade / Categoria
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60"
              >
                <option value="prospecting">Prospecting (Prospecção)</option>
                <option value="warming">Warming (Aquecimento)</option>
              </select>
            </div>
          </div>

          {/* Variables and Spintax Quick Injectors */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-300">
                Conteúdo da Mensagem
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">Inserir tag:</span>
                <button
                  type="button"
                  onClick={() => insertSnippet('{{name}}')}
                  className="px-1.5 py-0.5 text-[11px] font-mono rounded bg-slate-800 text-emerald-300 hover:bg-slate-700 border border-slate-700/80 transition-colors"
                >
                  {'{{name}}'}
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('{{city}}')}
                  className="px-1.5 py-0.5 text-[11px] font-mono rounded bg-slate-800 text-emerald-300 hover:bg-slate-700 border border-slate-700/80 transition-colors"
                >
                  {'{{city}}'}
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('{{company}}')}
                  className="px-1.5 py-0.5 text-[11px] font-mono rounded bg-slate-800 text-emerald-300 hover:bg-slate-700 border border-slate-700/80 transition-colors"
                >
                  {'{{company}}'}
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('{Olá|Oi|Bom dia}')}
                  className="px-1.5 py-0.5 text-[11px] font-mono rounded bg-slate-800 text-amber-300 hover:bg-slate-700 border border-slate-700/80 transition-colors"
                >
                  {'{Olá|Oi|...}'}
                </button>
              </div>
            </div>

            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite sua mensagem com variações em {opção 1|opção 2} e tags {{name}}..."
              className="w-full p-3 text-xs font-mono rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60 leading-relaxed resize-y"
            />
          </div>

          {/* Syntax Token Highlighter preview */}
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
            <p className="text-[11px] text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Leitura de Tags & Sintaxe Reconhecida:</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${safety.color}`}>
                {safety.label} · {variationsCount} combinações
              </span>
            </p>
            <div className="text-xs font-mono leading-relaxed break-words">
              {tokens.length === 0 ? (
                <span className="text-slate-600">Nenhum texto inserido.</span>
              ) : (
                tokens.map((token, index) => {
                  if (token.type === 'spintax') {
                    return (
                      <span
                        key={index}
                        className="text-amber-300 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20"
                        title="Bloco Spintax (escolhe aleatoriamente 1 opção)"
                      >
                        {token.value}
                      </span>
                    );
                  }
                  if (token.type === 'variable') {
                    return (
                      <span
                        key={index}
                        className="text-emerald-300 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20 font-semibold"
                        title="Variável de Lead substituída automaticamente"
                      >
                        {token.value}
                      </span>
                    );
                  }
                  return <span key={index} className="text-slate-300">{token.value}</span>;
                })
              )}
            </div>
          </div>
        </div>

        {/* Live Spintax Tester (WhatsApp Message Preview) */}
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Simulador Dinâmico de Spintax (Como o Lead Recebe)
              </h4>
            </div>
            <button
              onClick={() => setPreviewSeed((s) => s + 1)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5"
              title="Gera novas variações sorteadas"
            >
              <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sortear Novas Variações</span>
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Abaixo estão 3 exemplos de mensagens geradas em tempo real com os dados do lead teste (
            <strong className="text-slate-300">{sampleLead.name}</strong>, {sampleLead.city}). Cada lead da sua lista receberá uma variação única!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {generatedSamples.map((sampleText, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 flex flex-col justify-between relative group"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-[10px] text-slate-400 font-mono">
                  <span>Variação #{idx + 1}</span>
                  <span className="text-emerald-400">WhatsApp Preview</span>
                </div>
                <div className="py-2.5 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                  {sampleText}
                </div>
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Enviado às 14:{20 + idx * 2}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(sampleText)}
                    className="hover:text-emerald-400 p-0.5 rounded transition-colors"
                    title="Copiar texto gerado"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
