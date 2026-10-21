import React, { useState } from 'react';
import { X, Webhook, Copy, Check, Radio, Send, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface EvolutionWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshResponses?: () => void;
  webhookUrl?: string;
}

export const EvolutionWebhookModal: React.FC<EvolutionWebhookModalProps> = ({
  isOpen,
  onClose,
  onRefreshResponses,
  webhookUrl,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  if (!isOpen) return null;

  const webhookEndpoint = webhookUrl || `${window.location.origin}/api/webhook/evolution`;

  const sampleJsonPayload = JSON.stringify(
    {
      event: 'messages.upsert',
      instance: 'minha-instancia-01',
      data: {
        key: {
          remoteJid: '5511999998888@s.whatsapp.net',
          fromMe: false,
          id: '3EB0ABC123XYZ',
        },
        pushName: 'Nome do Cliente',
        message: {
          conversation: 'Olá! Tenho interesse na proposta comercial, pode me enviar mais detalhes?',
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    },
    null,
    2
  );

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookEndpoint);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(sampleJsonPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Webhook className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                URL de Webhook Real da Evolution API
              </h3>
              <p className="text-xs text-slate-400">
                Recebimento de mensagens em tempo real diretamente na Central de Respostas
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

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* URL Box */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                URL do Endpoint do Webhook
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                POST · Pronto para Receber
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookEndpoint}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-800 text-emerald-300 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopyUrl}
                className="px-3.5 py-2 text-xs font-medium rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 shrink-0"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Cole esta URL no painel da sua Evolution API ou configure via requisição:
              <code className="text-slate-300 ml-1">POST /webhook/set/{'{instanceName}'}</code>
            </p>
          </div>

          {/* Config Instructions */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3 text-xs">
            <h4 className="font-semibold text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Eventos que você deve marcar na Evolution API:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-mono text-emerald-300 font-semibold block">MESSAGES_UPSERT</span>
                  <span className="text-slate-400">Recebe cada nova mensagem que os leads enviarem.</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-mono text-emerald-300 font-semibold block">MESSAGES_UPDATE</span>
                  <span className="text-slate-400">Atualiza status de entrega e leitura das mensagens.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sample Payload Reference */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Exemplo do Payload Real da Evolution API</span>
              <button
                onClick={handleCopyPayload}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
              >
                {copiedPayload ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPayload ? 'Copiado!' : 'Copiar JSON'}</span>
              </button>
            </div>

            <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 overflow-x-auto max-h-40">
              {sampleJsonPayload}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
