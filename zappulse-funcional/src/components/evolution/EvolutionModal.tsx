import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  QrCode,
  Layers,
  Copy,
  Check,
  Zap,
  Globe,
  Key,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '../../api/client';

interface EvolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshChips?: () => Promise<void>;
  webhookUrl?: string;
  onToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
}

export const EvolutionModal: React.FC<EvolutionModalProps> = ({
  isOpen,
  onClose,
  onRefreshChips,
  webhookUrl: webhookUrlProp,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<'connection' | 'instances' | 'testSend' | 'webhook'>('connection');

  // Connection fields
  const [baseUrl, setBaseUrl] = useState('');
  const [globalToken, setGlobalToken] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    latencyMs?: number;
    instancesCount?: number;
    instances?: any[];
    error?: string;
  } | null>(null);

  // QR Code state
  const [selectedInstanceForQr, setSelectedInstanceForQr] = useState('');
  const [qrCodeData, setQrCodeData] = useState<{ base64?: string; code?: string; pairingCode?: string } | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  // Test message send state
  const [testInstance, setTestInstance] = useState('');
  const [testNumber, setTestNumber] = useState('');
  const [testText, setTestText] = useState('Olá! Esta é uma mensagem de teste do ZapPulse conectado à Evolution API 🚀');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Webhook copy state
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    const config = await apiClient.getEvolutionConfig();
    if (config.baseUrl) {
      setBaseUrl(config.baseUrl);
      // Auto test
      handleTest(config.baseUrl, '');
    }
  };

  if (!isOpen) return null;

  const webhookUrl = webhookUrlProp || `${window.location.origin}/api/webhook/evolution`;

  const handleTest = async (overrideUrl?: string, overrideToken?: string) => {
    const targetUrl = (overrideUrl !== undefined ? overrideUrl : baseUrl).trim();
    const targetToken = (overrideToken !== undefined ? overrideToken : globalToken).trim();

    if (!targetUrl) {
      onToast('warning', 'URL Obrigatória', 'Informe a URL da sua VPS ou servidor da Evolution API.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await apiClient.testEvolutionConnection({
      baseUrl: targetUrl,
      globalToken: targetToken,
    });

    setTestResult(res);
    setIsTesting(false);

    if (res.connected) {
      onToast(
        'success',
        'Evolution API Conectada!',
        `Comunicação bem-sucedida (${res.latencyMs}ms). ${res.instancesCount || 0} instância(s) encontrada(s).`
      );
      if (res.instances && res.instances.length > 0 && !testInstance) {
        setTestInstance(res.instances[0].instanceName);
      }
    } else {
      onToast(
        'error',
        'Falha ao Conectar Evolution API',
        res.error || 'Verifique se a VPS está online e se a URL e a API Key estão corretas.'
      );
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseUrl.trim()) return;

    setIsSaving(true);
    await apiClient.saveEvolutionConfig({
      baseUrl: baseUrl.trim(),
      globalToken: globalToken.trim() || undefined,
    });
    setIsSaving(false);

    await handleTest();
  };

  const handleSyncInstances = async () => {
    setIsTesting(true);
    const res = await apiClient.syncEvolutionInstances();
    setIsTesting(false);

    if (res.success) {
      onToast('success', 'Instâncias Sincronizadas', `${res.count} instância(s) importada(s) para o painel.`);
      if (onRefreshChips) await onRefreshChips();
    } else {
      onToast('error', 'Falha ao sincronizar', res.error || 'Não foi possível importar as instâncias.');
    }
  };

  const handleLoadQrCode = async (instName: string) => {
    setSelectedInstanceForQr(instName);
    setIsLoadingQr(true);
    setQrCodeData(null);

    const data = await apiClient.getEvolutionQrCode(instName);
    setIsLoadingQr(false);

    if (data && (data.base64 || data.code || data.qrcode)) {
      setQrCodeData({
        base64: data.base64 || data.qrcode?.base64,
        code: data.code || data.qrcode?.code,
        pairingCode: data.pairingCode,
      });
    } else {
      onToast('info', 'Status da Instância', data.message || 'Instância pode já estar conectada ou em espera.');
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInstance || !testNumber || !testText) {
      onToast('warning', 'Campos Incompletos', 'Preencha a instância, número do destinatário e mensagem.');
      return;
    }

    setIsSendingTest(true);
    const res = await apiClient.sendEvolutionTestMessage({
      instanceName: testInstance,
      number: testNumber,
      text: testText,
    });
    setIsSendingTest(false);

    if (res && (res.key || res.message || res.status === 'PENDING' || res.status === 'success')) {
      onToast('success', 'Mensagem Enviada!', `Disparo efetuado pela instância ${testInstance} para ${testNumber}.`);
    } else {
      onToast('error', 'Falha no Envio', res.error || res.message || 'A Evolution API recusou a requisição.');
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const isConnected = testResult?.connected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Conexão Evolution API</h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium border ${
                    isConnected
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  }`}
                >
                  {isConnected ? `Conectado (${testResult.latencyMs}ms)` : 'Não Conectado'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Integração direta com o servidor da sua Evolution API (VPS, Docker ou Cloud)
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
            <Globe className="w-3.5 h-3.5" />
            <span>Servidor & Token</span>
          </button>

          <button
            onClick={() => setActiveTab('instances')}
            className={`pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'instances'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Instâncias ({testResult?.instancesCount ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('testSend')}
            className={`pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'testSend'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Disparo Teste</span>
          </button>

          <button
            onClick={() => setActiveTab('webhook')}
            className={`pb-2.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'webhook'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Webhook Global</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* TAB 1: CONNECTION */}
          {activeTab === 'connection' && (
            <div className="space-y-4">
              <form onSubmit={handleSave} className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    URL da Evolution API (Base URL)
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.sua-vps.com ou http://192.168.1.100:8080"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-800 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Endereço público ou IP onde o container da Evolution API está rodando.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1">
                    Token Global de Autenticação (apikey / AUTHENTICATION_API_KEY)
                  </label>
                  <input
                    type="password"
                    value={globalToken}
                    onChange={(e) => setGlobalToken(e.target.value)}
                    placeholder="Seu token global configurado no .env da Evolution API"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-900 border border-slate-800 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Enviado no cabeçalho <code className="text-slate-400">apikey: SEU_TOKEN</code> em todas as requisições.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleTest()}
                    disabled={isTesting}
                    className="px-3 py-1.5 text-xs text-slate-300 hover:text-white rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Testando...' : 'Testar Conexão Agora'}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
                  >
                    <span>{isSaving ? 'Salvando...' : 'Salvar & Conectar'}</span>
                  </button>
                </div>
              </form>

              {/* Status Report */}
              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    testResult.connected
                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                      : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {testResult.connected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>
                      {testResult.connected
                        ? `Conexão estabelecida com sucesso! (${testResult.latencyMs}ms)`
                        : 'Falha na conexão com a Evolution API'}
                    </span>
                  </div>

                  {testResult.error && (
                    <p className="text-[11px] text-rose-300/90 font-mono mt-0.5">
                      {testResult.error}
                    </p>
                  )}

                  {testResult.connected && (
                    <div className="text-[11px] text-slate-300 pt-1">
                      Foram encontradas <strong>{testResult.instancesCount}</strong> instância(s) cadastradas na sua Evolution API.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INSTANCES */}
          {activeTab === 'instances' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Instâncias ativas detectadas na Evolution API
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncInstances}
                    disabled={isTesting}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>Importar para o Painel</span>
                  </button>
                </div>
              </div>

              {testResult?.instances && testResult.instances.length > 0 ? (
                <div className="space-y-2">
                  {testResult.instances.map((inst, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-800 bg-slate-950 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            inst.status === 'open' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        />
                        <div>
                          <div className="font-semibold text-white">{inst.instanceName}</div>
                          <div className="text-[11px] text-slate-400">
                            {inst.owner || 'Sem número vinculado'} · Status: <span className="font-mono">{inst.status}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {inst.status !== 'open' && (
                          <button
                            onClick={() => handleLoadQrCode(inst.instanceName)}
                            className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1"
                          >
                            <QrCode className="w-3 h-3" />
                            <span>Ver QR</span>
                          </button>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            inst.status === 'open'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}
                        >
                          {inst.status === 'open' ? 'Conectado' : 'Aguardando QR'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-slate-800 bg-slate-950 text-center text-xs text-slate-400 space-y-2">
                  <Smartphone className="w-8 h-8 text-slate-600 mx-auto" />
                  <p>Nenhuma instância retornada da Evolution API no momento.</p>
                  <p className="text-[11px] text-slate-500">
                    Clique em "Testar Conexão" na aba Servidor para verificar a URL e API Key.
                  </p>
                </div>
              )}

              {/* QR Code Preview Modal / Box if requested */}
              {selectedInstanceForQr && (
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">QR Code: {selectedInstanceForQr}</span>
                    <button
                      onClick={() => setSelectedInstanceForQr('')}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {isLoadingQr ? (
                    <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Gerando QR Code na Evolution API...</span>
                    </div>
                  ) : qrCodeData?.base64 ? (
                    <div className="flex flex-col items-center py-2">
                      <img
                        src={qrCodeData.base64}
                        alt="QR Code WhatsApp"
                        className="w-48 h-48 bg-white p-2 rounded-lg shadow-md"
                      />
                      <p className="text-[11px] text-slate-400 mt-2">
                        Abra o WhatsApp &gt; Aparelhos Conectados &gt; Conectar Aparelho
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Aguardando QR Code da instância ou a conexão já está ativa.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TEST DISPATCH */}
          {activeTab === 'testSend' && (
            <form onSubmit={handleSendTestMessage} className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Nome da Instância Remetente
                </label>
                <input
                  type="text"
                  value={testInstance}
                  onChange={(e) => setTestInstance(e.target.value)}
                  placeholder="ex: inst-alpha-01"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Número do WhatsApp Destinatário (com DDD e DDI)
                </label>
                <input
                  type="text"
                  value={testNumber}
                  onChange={(e) => setTestNumber(e.target.value)}
                  placeholder="ex: 5511999998888"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono focus:outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-200 mb-1">
                  Texto da Mensagem
                </label>
                <textarea
                  rows={3}
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSendingTest}
                  className="px-4 py-2 font-semibold rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingTest ? 'Disparando...' : 'Enviar Mensagem Teste'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: WEBHOOK SETUP */}
          {activeTab === 'webhook' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                <span className="font-semibold text-white block">
                  URL de Webhook para Respostas dos Leads
                </span>
                <p className="text-slate-400 text-[11px]">
                  Configure esta URL no painel da Evolution API ou via requisição <code className="text-slate-300">/webhook/set/{'{instanceName}'}</code> para que as mensagens recebidas caiam automaticamente na sua Central de Respostas.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 font-mono text-[11px]"
                  />
                  <button
                    onClick={handleCopyWebhook}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 shrink-0"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhook ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 text-[11px] text-slate-400 space-y-1.5">
                <span className="font-semibold text-slate-200">Eventos que devem ser ativados na Evolution API:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-300 font-mono">
                  <li>MESSAGES_UPSERT</li>
                  <li>MESSAGES_UPDATE</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
