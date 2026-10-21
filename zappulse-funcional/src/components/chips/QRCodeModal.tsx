import React, { useState, useEffect } from 'react';
import {
  X,
  QrCode,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Copy,
  Check,
  Radio,
} from 'lucide-react';
import { AgentChip } from '../../types';
import { apiClient } from '../../api/client';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  chip: AgentChip | null;
  onOpenEvolutionConfig?: () => void;
  onSuccessConnected?: (chipId: string) => void;
  onToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  chip,
  onOpenEvolutionConfig,
  onSuccessConnected,
  onToast,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'waiting' | 'connected' | 'error'>('waiting');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [countdown, setCountdown] = useState(20);
  const [pairingPhone, setPairingPhone] = useState('');

  useEffect(() => {
    if (isOpen && chip) {
      loadQrCode();
    } else {
      setQrBase64(null);
      setPairingCode(null);
      setStatus('waiting');
      setErrorMessage('');
    }
  }, [isOpen, chip]);

  // Polling / countdown for real Evolution API QR Code
  useEffect(() => {
    if (!isOpen || status === 'connected' || !chip) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadQrCode();
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, status, chip]);

  useEffect(() => {
    if (!isOpen || !chip || status === 'connected') return;
    const t = setInterval(async () => {
      try {
        const r = await apiClient.testChip(chip.id);
        if (r.state === 'open') {
          setStatus('connected');
          setQrBase64(null);
          onToast('success', 'WhatsApp Conectado!', `O chip ${chip.instanceName} está online.`);
          if (onSuccessConnected) onSuccessConnected(chip.id);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [isOpen, chip, status]);

  if (!isOpen || !chip) return null;

  const instanceName = chip.instanceName || chip.id;

  const loadQrCode = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await apiClient.getChipQr(chip.id, pairingPhone || undefined);
      if (data.state === 'open') {
        setStatus('connected');
        setQrBase64(null);
        onToast('success', 'WhatsApp Conectado!', `O chip ${instanceName} está online.`);
        if (onSuccessConnected) onSuccessConnected(chip.id);
      } else if (data.qr || data.pairingCode) {
        setQrBase64(data.qr || null);
        setPairingCode(data.pairingCode || null);
        setStatus('waiting');
        setCountdown(20);
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'Não foi possível gerar o QR Code agora.');
        setQrBase64(null);
      }
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Falha ao gerar QR Code.');
      setQrBase64(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPairingCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Conectar WhatsApp (QR Code)</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {instanceName}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pareamento real da instância com o WhatsApp
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
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          {status === 'connected' ? (
            <div className="py-8 flex flex-col items-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white">WhatsApp Conectado!</h4>
              <p className="text-xs text-slate-400 max-w-xs">
                A instância <strong className="text-slate-200">{instanceName}</strong> está conectado e pronto para operar.
              </p>
            </div>
          ) : qrBase64 ? (
            <>
              {/* Real QR Code Image returned by Evolution API */}
              <div className="p-3 bg-white rounded-2xl shadow-xl flex items-center justify-center min-w-[220px] min-h-[220px]">
                <img
                  src={qrBase64}
                  alt={`QR Code ${instanceName}`}
                  className="w-52 h-52 object-contain rounded-lg"
                />
              </div>

              {/* Expiration Bar */}
              <div className="w-full max-w-xs space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Atualizando em {countdown}s</span>
                  <button
                    onClick={loadQrCode}
                    disabled={isLoading}
                    className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Atualizar</span>
                  </button>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-1000"
                    style={{ width: `${(countdown / 30) * 100}%` }}
                  />
                </div>
              </div>

              {/* Pairing code if available */}
              {pairingCode && (
                <div className="w-full max-w-xs p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-400 block">Código de Pareamento</span>
                    <span className="font-mono font-bold text-emerald-400 tracking-wider">
                      {pairingCode}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyPairingCode}
                    className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              )}

              {/* Instructions */}
              <div className="text-left w-full max-w-xs p-3 rounded-xl border border-slate-800/80 bg-slate-950/40 text-[11px] text-slate-300 space-y-1">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Como escanear:</span>
                </p>
                <ol className="list-decimal pl-4 space-y-0.5 text-slate-400 text-[11px]">
                  <li>Abra o WhatsApp &gt; Configurações</li>
                  <li>Toque em <strong className="text-slate-300">Aparelhos conectados</strong></li>
                  <li>Toque em <strong className="text-slate-300">Conectar um aparelho</strong></li>
                  <li>Aponte a câmera para o QR Code acima</li>
                </ol>
              </div>
            </>
          ) : (
            <div className="py-6 px-4 flex flex-col items-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-white">
                Não foi possível gerar o QR Code
              </h4>
              <p className="text-xs text-slate-400 max-w-xs">
                {errorMessage ||
                  'Verifique o provedor do chip e tente novamente.'}
              </p>

              <div className="flex flex-col gap-2 w-full max-w-xs pt-2">
                {chip.provider === 'evolution' && (
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenEvolutionConfig) onOpenEvolutionConfig();
                  }}
                  className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Configurar Servidor Evolution API</span>
                </button>
                )}

                <button
                  onClick={loadQrCode}
                  disabled={isLoading}
                  className="w-full py-1.5 px-3 text-xs text-slate-300 hover:text-white rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Tentando reconectar...' : 'Tentar Novamente'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
