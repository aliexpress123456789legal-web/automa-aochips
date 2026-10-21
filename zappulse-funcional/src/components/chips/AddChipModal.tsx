import React, { useState } from 'react';
import { AgentChip, ChipStatus, ChipProxyConfig, ProxyProtocol, ProviderName } from '../../types';
import { X, Smartphone, Key, ShieldCheck, Hash, Network, Sparkles, Check } from 'lucide-react';
import { formatPhoneBR } from '../../utils/spintax';

interface AddChipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddChip: (chip: Omit<AgentChip, 'id' | 'lastSyncAt' | 'totalSent' | 'totalFailed'>) => void;
}

export const AddChipModal: React.FC<AddChipModalProps> = ({ isOpen, onClose, onAddChip }) => {
  const [instanceName, setInstanceName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<ProviderName>('baileys');
  const [status, setStatus] = useState<ChipStatus>('warming');
  const [maxMsgsPerHour, setMaxMsgsPerHour] = useState<number>(20);
  const [warmingDays, setWarmingDays] = useState<number>(0);
  const [deviceInfo, setDeviceInfo] = useState('Android 14 (Samsung A15)');

  // Proxy Configuration fields requested by user
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('8080');
  const [proxyProtocol, setProxyProtocol] = useState<ProxyProtocol>('socks5');
  const [proxyUsername, setProxyUsername] = useState('');
  const [proxyPassword, setProxyPassword] = useState('');
  const [rawProxyInput, setRawProxyInput] = useState('');

  if (!isOpen) return null;

  const handleParseRawProxy = () => {
    const raw = rawProxyInput.trim();
    if (!raw) return;

    if (raw.includes('@')) {
      const clean = raw.replace(/^[a-z]+:\/\//i, '');
      const [auth, hostPort] = clean.split('@');
      if (auth && hostPort) {
        const [u, p] = auth.split(':');
        const [h, portNum] = hostPort.split(':');
        if (h) setProxyHost(h);
        if (portNum) setProxyPort(portNum);
        if (u) setProxyUsername(u);
        if (p) setProxyPassword(p);
      }
    } else {
      const parts = raw.split(':');
      if (parts.length >= 2) {
        setProxyHost(parts[0]);
        setProxyPort(parts[1]);
        if (parts.length >= 4) {
          setProxyUsername(parts[2]);
          setProxyPassword(parts[3]);
        }
      }
    }
    setRawProxyInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instanceName.trim()) return;

    const initialTrust = status === 'warming' ? 65 : 85;

    const proxyConfig: ChipProxyConfig = {
      enabled: proxyEnabled,
      host: proxyHost.trim(),
      port: proxyPort.trim(),
      protocol: proxyProtocol,
      username: proxyUsername.trim(),
      password: proxyPassword.trim(),
      testStatus: 'untested',
    };

    onAddChip({
      instanceName: instanceName.trim(),
      phoneNumber: phoneNumber.trim() ? formatPhoneBR(phoneNumber) : '',
      provider,
      apiKey: apiKey.trim(),
      status,
      trustScore: initialTrust,
      msgsPerHour: status === 'warming' ? 10 : 20,
      maxMsgsPerHour: Number(maxMsgsPerHour) || 20,
      warmingDays: Number(warmingDays) || 0,
      warmingTargetDays: 21,
      connectionQuality: 'disconnected',
      deviceInfo,
      proxy: proxyConfig,
    });

    // Reset and close
    setInstanceName('');
    setPhoneNumber('');
    setApiKey('');
    setStatus('warming');
    setMaxMsgsPerHour(20);
    setWarmingDays(0);
    setProxyEnabled(false);
    setProxyHost('');
    setProxyPort('8080');
    setProxyUsername('');
    setProxyPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Cadastrar Novo Chip (Instância)</h3>
              <p className="text-xs text-slate-400">Conexão com o WhatsApp e proxy dedicado</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Como conectar este chip</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderName)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60"
            >
              <option value="baileys">Direto no WhatsApp (QR Code) — não precisa da Evolution</option>
              <option value="evolution">Via Evolution API (sua VPS)</option>
              <option value="mock">Modo teste (nada é enviado ao WhatsApp)</option>
            </select>
          </div>

          {/* Main Info */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nome da Instância
            </label>
            <input
              type="text"
              required
              placeholder="ex: inst-sp-vendas-03"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Identificador único do chip (letras, números, hífen). Na Evolution é o nome da instância.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Número do WhatsApp
              </label>
              <div className="relative">
                <Hash className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="(opcional) (11) 99876-5432"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Status Inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ChipStatus)}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60"
              >
                <option value="warming">Warming (Em Maturação)</option>
                <option value="active">Ativo (Pronto para Campanha)</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={provider === 'evolution' ? '' : 'opacity-40 pointer-events-none'}>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Token da instância (Evolution, opcional)
              </label>
              <div className="relative">
                <Key className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="deixe vazio para usar a chave global"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Limite Seguro (Msgs / Hora)
              </label>
              <input
                type="number"
                min={5}
                max={60}
                value={maxMsgsPerHour}
                onChange={(e) => setMaxMsgsPerHour(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60 font-mono"
              />
            </div>
          </div>

          {/* Dedicated Section: Configuração de Proxy para Evolution API */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <Network className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-white">Habilitar Proxy? (Sim/Não)</span>
                  <p className="text-[11px] text-slate-400">
                    Aplica IP dedicado ou residencial na Evolution API via <code className="text-emerald-400 font-mono">/proxy/set</code>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setProxyEnabled(!proxyEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  proxyEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    proxyEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {proxyEnabled && (
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-3">
                {/* Quick raw paste */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={rawProxyInput}
                    onChange={(e) => setRawProxyInput(e.target.value)}
                    placeholder="Colar do fornecedor (ip:porta:usuario:senha)"
                    className="flex-1 px-2.5 py-1.5 text-xs rounded bg-slate-900 border border-slate-800 text-white placeholder-slate-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleParseRawProxy}
                    className="px-2.5 py-1.5 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
                  >
                    Autopreencher
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Protocolo</label>
                    <select
                      value={proxyProtocol}
                      onChange={(e) => setProxyProtocol(e.target.value as ProxyProtocol)}
                      className="w-full px-2.5 py-1.5 text-xs rounded bg-slate-900 border border-slate-800 text-white font-mono"
                    >
                      <option value="socks5">socks5</option>
                      <option value="http">http</option>
                      <option value="https">https</option>
                      <option value="socks4">socks4</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Host do Proxy (Ex: proxy.exemplo.com ou 192.168.1.1)
                    </label>
                    <input
                      type="text"
                      required={proxyEnabled}
                      placeholder="proxy.exemplo.com"
                      value={proxyHost}
                      onChange={(e) => setProxyHost(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded bg-slate-900 border border-slate-800 text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Porta do Proxy</label>
                    <input
                      type="text"
                      required={proxyEnabled}
                      placeholder="8080"
                      value={proxyPort}
                      onChange={(e) => setProxyPort(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded bg-slate-900 border border-slate-800 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Usuário</label>
                    <input
                      type="text"
                      placeholder="usuario"
                      value={proxyUsername}
                      onChange={(e) => setProxyUsername(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded bg-slate-900 border border-slate-800 text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Senha</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={proxyPassword}
                      onChange={(e) => setProxyPassword(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded bg-slate-900 border border-slate-800 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}
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
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Conectar e Aplicar Proxy na API</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
