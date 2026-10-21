import React, { useState, useEffect } from 'react';
import { AgentChip, ChipProxyConfig, ProxyProtocol } from '../../types';
import { X, Network, ShieldCheck, Check, Sparkles, AlertCircle, Copy, ArrowRight, RefreshCw } from 'lucide-react';

interface EditProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  chip: AgentChip | null;
  onSaveProxy: (chipId: string, proxyConfig: ChipProxyConfig) => void;
}

export const EditProxyModal: React.FC<EditProxyModalProps> = ({
  isOpen,
  onClose,
  chip,
  onSaveProxy,
}) => {
  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8080');
  const [protocol, setProtocol] = useState<ProxyProtocol>('socks5');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Helper raw input
  const [rawProxyInput, setRawProxyInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'success' | 'failed' | 'idle';
    ip?: string;
    latency?: number;
    message?: string;
  }>({ status: 'idle' });

  useEffect(() => {
    if (chip) {
      if (chip.proxy) {
        setEnabled(chip.proxy.enabled);
        setHost(chip.proxy.host || '');
        setPort(chip.proxy.port || '8080');
        setProtocol(chip.proxy.protocol || 'socks5');
        setUsername(chip.proxy.username || '');
        setPassword(chip.proxy.password || '');
        setTestResult(
          chip.proxy.testStatus === 'success'
            ? { status: 'success', ip: chip.proxy.externalIp, latency: 135 }
            : { status: 'idle' }
        );
      } else {
        setEnabled(false);
        setHost('');
        setPort('8080');
        setProtocol('socks5');
        setUsername('');
        setPassword('');
        setTestResult({ status: 'idle' });
      }
    }
  }, [chip, isOpen]);

  if (!isOpen || !chip) return null;

  // Helper to parse provider string: ip:port:user:pass OR user:pass@host:port OR host:port
  const handleParseRaw = () => {
    const raw = rawProxyInput.trim();
    if (!raw) return;

    if (raw.includes('@')) {
      // format: user:pass@host:port or protocol://user:pass@host:port
      const clean = raw.replace(/^[a-z]+:\/\//i, '');
      const [auth, hostPort] = clean.split('@');
      if (auth && hostPort) {
        const [u, p] = auth.split(':');
        const [h, portNum] = hostPort.split(':');
        if (h) setHost(h);
        if (portNum) setPort(portNum);
        if (u) setUsername(u);
        if (p) setPassword(p);
      }
    } else {
      const parts = raw.split(':');
      if (parts.length >= 2) {
        setHost(parts[0]);
        setPort(parts[1]);
        if (parts.length >= 4) {
          setUsername(parts[2]);
          setPassword(parts[3]);
        }
      }
    }
    setRawProxyInput('');
  };

  const handleTestProxy = () => {
    if (!host.trim() || !port.trim()) return;
    setIsTesting(true);
    setTestResult({ status: 'idle' });

    fetch('/api/proxy/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: host.trim(), port: port.trim(), protocol, username: username.trim(), password: password.trim() }),
    })
      .then((r) => r.json())
      .then((d) => {
        setIsTesting(false);
        if (d.ok) {
          setTestResult({
            status: 'success',
            ip: d.ip,
            latency: d.latencyMs,
            message: 'Conexão estabelecida através do proxy. Este é o IP de saída que o WhatsApp vai enxergar.',
          });
        } else {
          setTestResult({ status: 'failed', message: d.error || 'Falha ao conectar pelo proxy.' } as any);
        }
      })
      .catch((e) => {
        setIsTesting(false);
        setTestResult({ status: 'failed', message: e.message } as any);
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const config: ChipProxyConfig = {
      enabled,
      host: host.trim(),
      port: port.trim(),
      protocol,
      username: username.trim(),
      password: password.trim(),
      testStatus: testResult.status === 'success' ? 'success' : enabled ? 'untested' : undefined,
      externalIp: testResult.ip,
      lastTestedAt: testResult.status === 'success' ? new Date().toISOString() : undefined,
    };

    onSaveProxy(chip.id, config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Configuração de Proxy do Chip</h3>
              <p className="text-xs text-slate-400">
                {chip.instanceName} · {chip.phoneNumber}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Endpoint call info */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-slate-200">Endpoint Evolution API:</span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                POST /proxy/set/{chip.instanceName}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Ao salvar, a Evolution API isola o tráfego desta instância através do IP do proxy dedicado/residencial, prevenindo cruzamento de reputação com outros números.
              </p>
            </div>
          </div>

          {/* Toggle: Habilitar Proxy? (Sim/Não) */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">Habilitar Proxy nesta Instância?</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {enabled
                  ? 'Ativo: todo o tráfego do WhatsApp passará pelo proxy externo configurado.'
                  : 'Desativado: a conexão utilizará o IP direto do servidor onde a Evolution API está hospedada.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                enabled ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {enabled && (
            <div className="space-y-4 pt-1">
              {/* Quick Parser from Provider string */}
              <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800/80 space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Colar do Fornecedor de Proxies (Autopreencher)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={rawProxyInput}
                    onChange={(e) => setRawProxyInput(e.target.value)}
                    placeholder="Cole aqui no formato ip:porta:usuario:senha"
                    className="flex-1 px-3 py-1.5 text-xs rounded bg-slate-900 border border-slate-800 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500/60"
                  />
                  <button
                    type="button"
                    onClick={handleParseRaw}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap"
                  >
                    Preencher
                  </button>
                </div>
              </div>

              {/* Protocol & Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Protocolo
                  </label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value as ProxyProtocol)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60 font-mono"
                  >
                    <option value="socks5">socks5 (Recomendado)</option>
                    <option value="http">http</option>
                    <option value="https">https</option>
                    <option value="socks4">socks4</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Host do Proxy (IP ou Domínio)
                  </label>
                  <input
                    type="text"
                    required={enabled}
                    placeholder="proxy.exemplo.com ou 192.168.1.1"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Porta do Proxy
                  </label>
                  <input
                    type="text"
                    required={enabled}
                    placeholder="8080 ou 10001"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Usuário (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="usuario_proxy"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Senha (Opcional)
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
              </div>

              {/* Test Proxy Connection Button & Status */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-300">
                    Validação do Proxy
                  </div>
                  <button
                    type="button"
                    disabled={isTesting || !host.trim()}
                    onClick={handleTestProxy}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-800/80 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Testando conexão...' : 'Testar Conexão / Ping'}</span>
                  </button>
                </div>

                {testResult.status === 'success' && (
                  <div className="flex items-start gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/20 font-mono">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-emerald-300">Proxy Operacional ({testResult.latency}ms)</p>
                      <p className="text-[11px] text-emerald-400/90 mt-0.5">
                        IP Externo Detectado: {testResult.ip}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Proxy Strategy Flow Diagram */}
          <div className="p-3.5 rounded-lg border border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-400 space-y-2">
            <span className="font-semibold text-slate-300">Fluxo de Isolamento de IP Antiban:</span>
            <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] font-mono py-1">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 whitespace-nowrap">
                Dashboard ZapPulse
              </span>
              <span>→</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 whitespace-nowrap">
                Evolution API (/proxy/set)
              </span>
              <span>→</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 whitespace-nowrap">
                Conexão do Chip
              </span>
              <span>→</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 whitespace-nowrap">
                Proxy Residencial Externo
              </span>
              <span>→</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 whitespace-nowrap">
                Servidores do WhatsApp
              </span>
            </div>
          </div>

          {/* Footer Actions */}
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
              <span>Salvar Configuração de Proxy</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
