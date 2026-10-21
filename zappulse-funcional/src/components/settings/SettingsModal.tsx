import React, { useEffect, useState } from 'react';
import { X, Settings, Clock, ShieldBan, Activity, Play, Save } from 'lucide-react';
import { AppSettings, EngineInfo, AgentChip } from '../../types';
import { apiClient } from '../../api/client';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings | null;
  engine: EngineInfo | null;
  chips: AgentChip[];
  onSaved: () => Promise<void> | void;
  onToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, desc?: string) => void;
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const inputCls =
  'w-full px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, engine, chips, onSaved, onToast }) => {
  const [form, setForm] = useState<AppSettings | null>(null);
  const [keywords, setKeywords] = useState('');
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (isOpen && settings) {
      setForm(JSON.parse(JSON.stringify(settings)));
      setKeywords(settings.optOutKeywords.join(', '));
    }
    // só reinicia o formulário ao abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !form) return null;

  const set = (patch: Partial<AppSettings>) => setForm({ ...form, ...patch });
  const setWin = (patch: Partial<AppSettings['window']>) => setForm({ ...form, window: { ...form.window, ...patch } });

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.updateSettings({
        defaultProvider: form.defaultProvider,
        workerEnabled: form.workerEnabled,
        window: form.window,
        dailyLimitPerChip: form.dailyLimitPerChip,
        optOutKeywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        publicUrl: form.publicUrl,
      });
      await onSaved();
      onToast('success', 'Configurações salvas');
      onClose();
    } catch (e: any) {
      onToast('error', 'Erro ao salvar', e.message);
    } finally {
      setSaving(false);
    }
  };

  const runCycle = async () => {
    setRunning(true);
    const r = await apiClient.runWorkerCycle();
    setRunning(false);
    onToast(r.success ? 'info' : 'warning', 'Ciclo executado', r.logs.join(' • ') || r.message);
    await onSaved();
  };

  const chipName = (id?: string) => chips.find((c) => c.id === id)?.instanceName || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Configurações & Motor de Disparo</h3>
              <p className="text-xs text-slate-400">Provedor, janela de envio, opt-out e atividade em tempo real</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Motor */}
          <section className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" /> Motor (worker)
              </h4>
              <div className="flex items-center gap-2 text-[11px]">
                <span
                  className={`px-2 py-0.5 rounded border font-mono ${
                    form.workerEnabled ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-400 border-slate-700'
                  }`}
                >
                  {form.workerEnabled ? 'LIGADO' : 'DESLIGADO'}
                </span>
                {engine && (
                  <span
                    className={`px-2 py-0.5 rounded border font-mono ${
                      engine.inWindow ? 'text-emerald-300 border-emerald-500/30' : 'text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {engine.inWindow ? 'dentro da janela' : 'fora da janela de envio'}
                  </span>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={form.workerEnabled} onChange={(e) => set({ workerEnabled: e.target.checked })} />
              Worker ligado (envia lotes ativos automaticamente, respeitando intervalo e limites)
            </label>
            <button
              onClick={runCycle}
              disabled={running}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> {running ? 'Executando...' : 'Rodar um ciclo agora (ignora janela e intervalo)'}
            </button>
            {engine?.reason && <p className="text-[11px] text-amber-300">⚠ {engine.reason}</p>}
          </section>

          {/* Provedor */}
          <section className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">Provedor padrão para novos chips</label>
            <select
              value={form.defaultProvider}
              onChange={(e) => set({ defaultProvider: e.target.value as AppSettings['defaultProvider'] })}
              className={inputCls}
            >
              <option value="baileys">Direto no WhatsApp (QR Code) — sem Evolution</option>
              <option value="evolution">Evolution API</option>
              <option value="mock">Modo teste (não envia nada)</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Cada chip guarda seu próprio provedor. Se a Evolution cair, crie/migre chips para "Direto no WhatsApp".
            </p>
          </section>

          {/* Janela */}
          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-400" /> Janela de envio
            </h4>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={form.window.enabled} onChange={(e) => setWin({ enabled: e.target.checked })} />
              Só enviar dentro do horário comercial (recomendado contra banimento)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="block text-[11px] text-slate-400 mb-1">Início</span>
                <input type="time" value={form.window.start} onChange={(e) => setWin({ start: e.target.value })} className={inputCls} />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 mb-1">Fim</span>
                <input type="time" value={form.window.end} onChange={(e) => setWin({ end: e.target.value })} className={inputCls} />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 mb-1">Fuso horário</span>
                <input value={form.window.timezone} onChange={(e) => setWin({ timezone: e.target.value })} className={inputCls + ' font-mono'} />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d, i) => {
                const on = form.window.days.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setWin({ days: on ? form.window.days.filter((x) => x !== i) : [...form.window.days, i] })}
                    className={`px-2.5 py-1 text-[11px] rounded border ${
                      on ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <div className="max-w-[200px]">
              <span className="block text-[11px] text-slate-400 mb-1">Limite diário por chip</span>
              <input
                type="number"
                min={1}
                value={form.dailyLimitPerChip}
                onChange={(e) => set({ dailyLimitPerChip: Number(e.target.value) })}
                className={inputCls + ' font-mono'}
              />
            </div>
          </section>

          {/* Opt-out */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
              <ShieldBan className="w-4 h-4 text-emerald-400" /> Opt-out automático
            </h4>
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={inputCls} />
            <p className="text-[11px] text-slate-500">
              Palavras (separadas por vírgula) que, ao serem respondidas pelo lead, bloqueiam novos envios a esse número em todos os lotes.
            </p>
          </section>

          {/* URL pública */}
          <section className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">URL pública deste painel (para webhooks da Evolution)</label>
            <input
              value={form.publicUrl}
              placeholder="https://painel.seudominio.com"
              onChange={(e) => set({ publicUrl: e.target.value })}
              className={inputCls + ' font-mono'}
            />
            <p className="text-[11px] text-slate-500">
              {form.panelProtected
                ? '🔒 Painel protegido por senha (PANEL_PASSWORD).'
                : '⚠ Painel SEM senha. Se for expor na internet, defina PANEL_PASSWORD no .env.'}
            </p>
          </section>

          {/* Atividade */}
          <section className="space-y-2">
            <h4 className="text-xs font-semibold text-white">Atividade recente</h4>
            <div className="rounded-lg border border-slate-800 bg-slate-950 max-h-48 overflow-y-auto divide-y divide-slate-800/60">
              {!engine || engine.recentLogs.length === 0 ? (
                <p className="p-3 text-[11px] text-slate-500">Nenhuma atividade ainda.</p>
              ) : (
                engine.recentLogs.map((l) => (
                  <div key={l.id} className="px-3 py-1.5 text-[11px] flex gap-2">
                    <span className="text-slate-500 font-mono shrink-0">{new Date(l.ts).toLocaleTimeString('pt-BR')}</span>
                    <span className={l.ok ? 'text-emerald-400' : 'text-rose-400'}>{l.ok ? '✓' : '✗'}</span>
                    <span className="text-slate-400 shrink-0">{l.kind}</span>
                    {l.chipId && <span className="text-slate-500 shrink-0">{chipName(l.chipId)}</span>}
                    <span className="text-slate-300 truncate" title={l.message || l.error}>
                      {l.error || l.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="px-6 py-3 border-t border-slate-800 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg text-slate-300 hover:bg-slate-800">
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};
