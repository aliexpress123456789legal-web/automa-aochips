import React, { useState } from 'react';
import { LeadResponse, Batch, AgentChip, ResponseSentiment } from '../../types';
import { getWhatsAppWebUrl } from '../../utils/spintax';
import {
  Inbox,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  Send,
  User,
  Phone,
  MapPin,
  Layers,
  Smartphone,
  Tag,
} from 'lucide-react';

interface ResponseInboxProps {
  responses: LeadResponse[];
  batches: Batch[];
  chips: AgentChip[];
  onMarkAsAttended: (responseId: string) => void;
  onUpdateSentiment: (responseId: string, sentiment: ResponseSentiment) => void;
  onSendQuickReply: (responseId: string, replyText: string) => void;
  onOpenWebhookModal: () => void;
}

export const ResponseInbox: React.FC<ResponseInboxProps> = ({
  responses,
  batches,
  chips,
  onMarkAsAttended,
  onUpdateSentiment,
  onSendQuickReply,
  onOpenWebhookModal,
}) => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState<'all' | ResponseSentiment>('all');
  const [selectedResponseId, setSelectedResponseId] = useState<string>(
    responses[0]?.id || ''
  );
  const [quickReplyText, setQuickReplyText] = useState('');

  // Filter responses
  const filteredResponses = responses
    .filter((resp) => {
      const matchesBatch = selectedBatchId === 'all' || resp.batchId === selectedBatchId;
      const matchesSentiment =
        sentimentFilter === 'all' || resp.responseSentiment === sentimentFilter;
      const matchesSearch =
        resp.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resp.leadPhone.includes(searchTerm) ||
        resp.messageReceived.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesBatch && matchesSentiment && matchesSearch;
    })
    // Sort strictly by receivedAt descending (newest first)
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

  const activeResponse =
    responses.find((r) => r.id === selectedResponseId) || filteredResponses[0];

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / (60 * 1000));
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'Agora mesmo';
    if (mins < 60) return `${mins}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return `${days}d atrás`;
  };

  const getSentimentDetails = (sentiment: ResponseSentiment) => {
    switch (sentiment) {
      case 'interested':
        return { label: 'Interessado', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'pricing':
        return { label: 'Pediu Orçamento', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
      case 'curious':
        return { label: 'Dúvida / Call', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'not_interested':
        return { label: 'Sem Interesse', color: 'text-slate-400 bg-slate-800 border-slate-700' };
      case 'unsubscribed':
        return { label: 'Opt-out / Sair', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
      default:
        return { label: 'Geral', color: 'text-slate-400 bg-slate-800 border-slate-700' };
    }
  };

  const handleAttendWhatsApp = (resp: LeadResponse) => {
    onMarkAsAttended(resp.id);
    const defaultMsg = `Olá ${resp.leadName}, tudo bem? Estou dando sequência ao nosso contato sobre a solução que conversamos!`;
    const url = getWhatsAppWebUrl(resp.leadPhone, defaultMsg);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSendQuick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickReplyText.trim() || !activeResponse) return;
    onSendQuickReply(activeResponse.id, quickReplyText.trim());
    setQuickReplyText('');
  };

  const activeBatch = batches.find((b) => b.id === activeResponse?.batchId);
  const activeChip = chips.find((c) => c.id === activeResponse?.agentId);

  return (
    <div className="space-y-4">
      {/* Filters & Webhook Quick Action Bar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou mensagem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* Lote Filter (Requirement 4: "Poder filtrar por Lote para saber de qual campanha aquele lead veio") */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60"
            >
              <option value="all">Todos os Lotes ({responses.length})</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sentiment Filter */}
          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60"
          >
            <option value="all">Todas as Intenções</option>
            <option value="interested">Interessado</option>
            <option value="pricing">Pediu Preço</option>
            <option value="curious">Dúvida / Call</option>
            <option value="not_interested">Sem Interesse</option>
          </select>
        </div>

        <button
          onClick={onOpenWebhookModal}
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/60 transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Simular Novo Lead (Webhook)</span>
        </button>
      </div>

      {/* Main Inbox split view: Left Conversation List, Right Lead Detail & WhatsApp Web action */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: List of incoming responses (Order of arrival: newest on top) */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col max-h-[720px]">
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Leads Respondendo ({filteredResponses.length})</span>
            <span className="text-[11px] font-mono text-emerald-400 font-normal">
              Tempo Real · Mais Recentes no Topo
            </span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/60 flex-1">
            {filteredResponses.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Inbox className="w-8 h-8 mx-auto text-slate-600 mb-2 opacity-50" />
                <p className="text-xs font-medium text-slate-400">Nenhuma resposta encontrada</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Ajuste os filtros de lote ou simule um evento de webhook da Evolution API.
                </p>
              </div>
            ) : (
              filteredResponses.map((resp) => {
                const isSelected = resp.id === activeResponse?.id;
                const batch = batches.find((b) => b.id === resp.batchId);
                const sentiment = getSentimentDetails(resp.responseSentiment);
                const isUnread = resp.status === 'unread';

                return (
                  <div
                    key={resp.id}
                    onClick={() => setSelectedResponseId(resp.id)}
                    className={`p-3.5 cursor-pointer transition-colors text-left relative ${
                      isSelected
                        ? 'bg-slate-800/90 border-l-2 border-emerald-400'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          )}
                          <span
                            className={`text-xs truncate ${
                              isUnread ? 'font-bold text-white' : 'font-medium text-slate-200'
                            }`}
                          >
                            {resp.leadName || 'Lead Sem Nome'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {resp.leadPhone}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-300 line-clamp-2 mt-1 leading-snug">
                          {resp.messageReceived}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                          {formatRelativeTime(resp.receivedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 truncate max-w-[180px]">
                        Lote: <strong className="text-slate-300 font-normal">{batch?.name || 'Geral'}</strong>
                      </span>
                      <span className={`px-1.5 py-0.5 rounded font-mono border ${sentiment.color}`}>
                        {sentiment.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Lead Conversation & WhatsApp Action */}
        <div className="lg:col-span-7 space-y-4">
          {activeResponse ? (
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-5">
              {/* Lead Top Bar Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white truncate">
                      {activeResponse.leadName}
                    </h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        getSentimentDetails(activeResponse.responseSentiment).color
                      }`}
                    >
                      {getSentimentDetails(activeResponse.responseSentiment).label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Phone className="w-3 h-3 text-emerald-400" />
                      {activeResponse.leadPhone}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {activeResponse.leadCity}
                    </span>
                  </div>
                </div>

                {/* Primary Action requested by user: Button "Atender" (Abre WhatsApp Web do lead) */}
                <button
                  onClick={() => handleAttendWhatsApp(activeResponse)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors flex items-center gap-2 shadow-sm shadow-emerald-500/20 whitespace-nowrap self-start sm:self-auto"
                >
                  <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Atender no WhatsApp Web</span>
                </button>
              </div>

              {/* Origin Context Strip */}
              <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-lg bg-slate-950 border border-slate-800/80">
                <div>
                  <span className="text-slate-500 text-[11px] block">Campanha de Origem:</span>
                  <span className="font-medium text-slate-300 truncate block">
                    {activeBatch?.name || 'Lote Padrão'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Chip Remetente:</span>
                  <span className="font-mono text-slate-300 text-[11px] truncate block">
                    {activeChip?.instanceName || 'inst-sp-prospecting-01'} ({activeChip?.phoneNumber || 'Chip Principal'})
                  </span>
                </div>
              </div>

              {/* Message Exchange Flow */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Histórico do Diálogo
                </p>

                {/* 1. Outbound message that was sent to the lead */}
                <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="text-emerald-400">Mensagem Enviada (Disparo da Campanha)</span>
                    <span>Disparado via ZapPulse</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {activeResponse.outboundMessageSent}
                  </p>
                </div>

                {/* 2. Inbound message received from lead */}
                <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Resposta Recebida do Lead (Evolution API Webhook)
                    </span>
                    <span className="text-slate-400">
                      {new Date(activeResponse.receivedAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium leading-relaxed">
                    "{activeResponse.messageReceived}"
                  </p>
                </div>
              </div>

              {/* Qualification Tags Bar */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Qualificar Lead:</span>
                  <button
                    onClick={() => onUpdateSentiment(activeResponse.id, 'interested')}
                    className="px-2 py-0.5 text-[11px] rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  >
                    Interessado
                  </button>
                  <button
                    onClick={() => onUpdateSentiment(activeResponse.id, 'pricing')}
                    className="px-2 py-0.5 text-[11px] rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30"
                  >
                    Orçamento
                  </button>
                  <button
                    onClick={() => onUpdateSentiment(activeResponse.id, 'not_interested')}
                    className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  >
                    Sem Interesse
                  </button>
                </div>

                {activeResponse.status !== 'attended' ? (
                  <button
                    onClick={() => onMarkAsAttended(activeResponse.id)}
                    className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Marcar como Atendido</span>
                  </button>
                ) : (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Atendimento Concluído</span>
                  </span>
                )}
              </div>

              {/* Quick Reply Form directly from the panel */}
              <form onSubmit={handleSendQuick} className="pt-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Resposta Rápida (Disparo via Evolution API)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={quickReplyText}
                    onChange={(e) => setQuickReplyText(e.target.value)}
                    placeholder="Digite uma mensagem rápida para enviar ao lead agora..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                  <button
                    type="submit"
                    disabled={!quickReplyText.trim()}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-emerald-400 hover:text-slate-950 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-12 rounded-xl border border-slate-800 bg-slate-900/40 text-center text-slate-500">
              <Inbox className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
              <p className="text-sm font-medium text-slate-400">Selecione uma resposta na lista ao lado</p>
              <p className="text-xs text-slate-500 mt-1">
                Aqui você visualiza os dados do lead, histórico do disparo e botão de atendimento direto no WhatsApp.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
