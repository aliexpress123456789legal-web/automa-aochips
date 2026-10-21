import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AgentChip,
  Batch,
  Template,
  Lead,
  LeadResponse,
  HourlyTelemetry,
  ChipStatus,
  ResponseSentiment,
  ChipProxyConfig,
  AppSettings,
  EngineInfo,
} from './types';
import { Sidebar, NavigationTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ChipsManagement } from './components/chips/ChipsManagement';
import { AddChipModal } from './components/chips/AddChipModal';
import { EditProxyModal } from './components/chips/EditProxyModal';
import { QRCodeModal } from './components/chips/QRCodeModal';
import { CampaignsManagement } from './components/campaigns/CampaignsManagement';
import { BatchModal } from './components/campaigns/BatchModal';
import { HealthDashboard } from './components/health/HealthDashboard';
import { ResponseInbox } from './components/inbox/ResponseInbox';
import { EvolutionWebhookModal } from './components/inbox/EvolutionWebhookModal';
import { EvolutionModal } from './components/evolution/EvolutionModal';
import { PostgresModal } from './components/db/PostgresModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { ToastContainer, ToastMessage } from './components/common/Toast';
import { apiClient } from './api/client';
import type { DbStatus } from './db/postgres';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('chips');

  // O servidor é a única fonte da verdade (data/db.json). O front só espelha.
  const [chips, setChips] = useState<AgentChip[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [leads] = useState<Lead[]>([]);
  const [responses, setResponses] = useState<LeadResponse[]>([]);
  const [telemetry, setTelemetry] = useState<HourlyTelemetry[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [engine, setEngine] = useState<EngineInfo | null>(null);
  const [serverOnline, setServerOnline] = useState(true);

  // Modals state
  const [isAddChipOpen, setIsAddChipOpen] = useState(false);
  const [editingProxyChip, setEditingProxyChip] = useState<AgentChip | null>(null);
  const [qrChip, setQrChip] = useState<AgentChip | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [isPostgresModalOpen, setIsPostgresModalOpen] = useState(false);
  const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEvolutionConnected, setIsEvolutionConnected] = useState(false);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastMessage['type'], title: string, description?: string) => {
    const id = 'toast-' + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const failToast = (title: string) => (e: any) => addToast('error', title, e?.message || String(e));

  // ---- sincronização com o servidor
  const refresh = useCallback(async () => {
    try {
      const st = await apiClient.getState();
      setChips(st.chips);
      setBatches(st.batches);
      setTemplates(st.templates);
      setResponses(st.responses);
      setTelemetry(st.telemetry);
      setSettings(st.settings);
      setEngine(st.engine);
      setServerOnline(true);
    } catch {
      setServerOnline(false);
    }
  }, []);

  const refreshDbStatus = async () => {
    setDbStatus(await apiClient.getDbStatus());
    await refresh();
  };

  const refreshEvolutionStatus = async () => {
    try {
      const config = await apiClient.getEvolutionConfig();
      if (config.configured && config.baseUrl) {
        const res = await apiClient.testEvolutionConnection({ baseUrl: config.baseUrl, globalToken: '' });
        setIsEvolutionConnected(res.connected);
      } else {
        setIsEvolutionConnected(false);
      }
    } catch {
      setIsEvolutionConnected(false);
    }
  };

  useEffect(() => {
    refresh();
    apiClient.getDbStatus().then(setDbStatus);
    refreshEvolutionStatus();
    const poll = setInterval(refresh, 4000);
    const evo = setInterval(refreshEvolutionStatus, 60000);
    return () => {
      clearInterval(poll);
      clearInterval(evo);
    };
  }, [refresh]);

  // Avisa quando o servidor cai
  const wasOnline = useRef(true);
  useEffect(() => {
    if (wasOnline.current && !serverOnline) addToast('error', 'Servidor offline', 'O painel perdeu contato com o servidor local.');
    wasOnline.current = serverOnline;
  }, [serverOnline]);

  const handleConnectPostgres = async (connStr: string) => {
    const status = await apiClient.connectDb(connStr);
    setDbStatus(status);
    if (status.connected) {
      addToast('success', 'PostgreSQL Conectado', `Conexão com ${status.database || 'banco'} (${status.latencyMs}ms). Schema aplicado.`);
      return true;
    }
    addToast('error', 'Falha ao Conectar PostgreSQL', status.error || 'Verifique usuário, senha e porta 5432.');
    return false;
  };

  const handleRunMigration = async () => {
    const res = await apiClient.runMigration();
    if (res.success) {
      addToast('success', 'Migração DDL Executada', 'Schema verificado no Postgres.');
      await refreshDbStatus();
      return true;
    }
    addToast('error', 'Erro na Migração', res.message);
    return false;
  };

  const handleRunWorkerCycle = async () => {
    const res = await apiClient.runWorkerCycle();
    await refresh();
    return res;
  };

  // ---- Chips
  const handleUpdateChipStatus = async (chipId: string, newStatus: ChipStatus) => {
    const chip = chips.find((c) => c.id === chipId);
    try {
      await apiClient.updateChip(chipId, { status: newStatus });
      addToast('info', 'Status Atualizado', `${chip?.instanceName || chipId} → ${newStatus.toUpperCase()}.`);
    } catch (e) {
      failToast('Falha ao atualizar status')(e);
    }
    refresh();
  };

  const handleDeleteChip = async (chipId: string) => {
    const chip = chips.find((c) => c.id === chipId);
    try {
      await apiClient.deleteChip(chipId);
      addToast('warning', 'Chip Removido', `${chip?.instanceName} foi removido e a sessão encerrada.`);
    } catch (e) {
      failToast('Falha ao remover chip')(e);
    }
    refresh();
  };

  const handleAddChip = async (newChipData: Omit<AgentChip, 'id' | 'lastSyncAt' | 'totalSent' | 'totalFailed'>) => {
    try {
      const { chip } = await apiClient.createChip(newChipData);
      await refresh();
      if (chip.provider === 'mock') {
        addToast('success', 'Chip de teste criado', 'Já está "online" — nada será enviado ao WhatsApp de verdade.');
      } else {
        addToast('success', 'Chip cadastrado', `Gerando QR Code de ${chip.instanceName}...`);
        setQrChip(chip);
      }
    } catch (e) {
      failToast('Não foi possível cadastrar o chip')(e);
    }
  };

  const handleTestConnection = async (chip: AgentChip) => {
    try {
      const r = await apiClient.testChip(chip.id);
      if (r.state === 'open') {
        addToast('success', 'Chip online', `${chip.instanceName} respondeu em ${r.latencyMs}ms.`);
      } else {
        addToast('error', 'Chip desconectado', r.error || `${chip.instanceName} não está conectado. Leia o QR Code.`);
      }
    } catch (e) {
      failToast('Falha no teste')(e);
    }
    refresh();
  };

  const handleSaveProxy = async (chipId: string, proxyConfig: ChipProxyConfig) => {
    const chip = chips.find((c) => c.id === chipId);
    try {
      const r = await apiClient.updateChip(chipId, { proxy: proxyConfig });
      if (r.proxyApplied === false) {
        addToast('warning', 'Proxy salvo, mas não aplicado', r.proxyError || 'Falha ao aplicar no provedor.');
      } else {
        addToast(
          'success',
          proxyConfig.enabled ? 'Proxy aplicado' : 'Proxy desativado',
          `Chip ${chip?.instanceName || chipId}${proxyConfig.enabled ? ` usando ${proxyConfig.protocol.toUpperCase()} ${proxyConfig.host}:${proxyConfig.port}` : ''}.`
        );
      }
    } catch (e) {
      failToast('Falha ao salvar proxy')(e);
    }
    refresh();
  };

  // ---- Lotes
  const handleToggleBatchStatus = async (batchId: string) => {
    const b = batches.find((x) => x.id === batchId);
    if (!b) return;
    const newStatus = b.status === 'active' ? 'paused' : 'active';
    try {
      await apiClient.updateBatch(batchId, { status: newStatus });
      if (newStatus === 'active') {
        const ready = chips.some((c) => c.status === 'active' && c.connection === 'open');
        if (!ready) addToast('warning', 'Lote ativado, mas sem chip pronto', 'Precisa haver um chip ATIVO e online para o worker enviar.');
        else if (b.pendingCount === 0) addToast('warning', 'Lote sem leads pendentes', 'Importe leads (CSV) para este lote.');
      }
    } catch (e) {
      failToast('Falha ao alterar lote')(e);
    }
    refresh();
  };

  const handleDeleteBatch = async (batchId: string) => {
    try {
      await apiClient.deleteBatch(batchId);
      addToast('warning', 'Lote Excluído', 'O lote e seus leads foram removidos.');
    } catch (e) {
      failToast('Falha ao excluir lote')(e);
    }
    refresh();
  };

  const handleCreateBatch = async (
    newBatchData: Omit<Batch, 'id' | 'createdAt' | 'sentCount' | 'deliveredCount' | 'repliedCount' | 'failedCount' | 'totalLeads'>
  ) => {
    try {
      // Lote nasce pausado: o usuário importa os leads e só então ativa.
      await apiClient.saveBatch({ ...newBatchData, status: 'paused' });
      addToast('success', 'Lote Criado', `"${newBatchData.name}" criado (pausado). Importe os leads e ative quando estiver pronto.`);
    } catch (e) {
      failToast('Falha ao criar lote')(e);
    }
    refresh();
  };

  // ---- Templates
  const handleSaveTemplate = async (tpl: Template) => {
    try {
      await apiClient.saveTemplate(tpl);
      addToast('success', 'Template Salvo', `"${tpl.title}" gravado.`);
    } catch (e) {
      failToast('Falha ao salvar template')(e);
    }
    refresh();
  };

  const handleDeleteTemplate = async (tplId: string) => {
    try {
      await apiClient.deleteTemplate(tplId);
      addToast('info', 'Template Removido');
    } catch (e) {
      failToast('Falha ao remover template')(e);
    }
    refresh();
  };

  // ---- Leads
  const handleImportLeads = async (batchId: string, newLeadsData: Omit<Lead, 'id'>[]) => {
    try {
      const r = await apiClient.importLeads(batchId, newLeadsData);
      const extra = [
        r.duplicates ? `${r.duplicates} duplicado(s)` : '',
        r.invalid ? `${r.invalid} telefone(s) inválido(s)` : '',
        r.optOut ? `${r.optOut} em opt-out` : '',
      ]
        .filter(Boolean)
        .join(', ');
      addToast('success', `${r.added} lead(s) importado(s)`, extra ? `Ignorados: ${extra}.` : 'Prontos na fila do worker.');
    } catch (e) {
      failToast('Falha ao importar leads')(e);
    }
    refresh();
  };

  // ---- Disparo manual: roda um ciclo REAL do worker
  const handleTriggerSingleDispatch = async () => {
    const res = await apiClient.runWorkerCycle();
    addToast(res.success ? 'info' : 'warning', 'Ciclo do worker', res.logs.join(' • ') || res.message || 'Sem atividade.');
    refresh();
  };

  // ---- Inbox
  const handleMarkAsAttended = async (responseId: string) => {
    setResponses((prev) => prev.map((r) => (r.id === responseId ? { ...r, status: 'attended' } : r)));
    try {
      await apiClient.updateResponse(responseId, { status: 'attended' });
      addToast('success', 'Atendimento Concluído', 'Lead marcado como atendido.');
    } catch (e) {
      failToast('Falha ao atualizar')(e);
    }
    refresh();
  };

  const handleUpdateSentiment = async (responseId: string, sentiment: ResponseSentiment) => {
    setResponses((prev) => prev.map((r) => (r.id === responseId ? { ...r, responseSentiment: sentiment } : r)));
    apiClient.updateResponse(responseId, { responseSentiment: sentiment }).catch(failToast('Falha ao atualizar'));
  };

  const handleSendQuickReply = async (responseId: string, replyText: string) => {
    try {
      const r = await apiClient.replyResponse(responseId, replyText);
      if (r.ok) addToast('success', 'Mensagem enviada', `"${replyText.slice(0, 80)}"`);
      else addToast('error', 'Não foi possível enviar', r.error);
    } catch (e) {
      failToast('Não foi possível enviar')(e);
    }
    refresh();
  };

  const webhookUrl = settings
    ? `${settings.publicUrl || window.location.origin}/api/webhook/evolution?token=${settings.webhookToken}`
    : undefined;

  // Counts for sidebar badges
  const unreadResponsesCount = responses.filter((r) => r.status === 'unread').length;
  const activeChipsCount = chips.filter((c) => c.status === 'active').length;
  const bannedChipsCount = chips.filter((c) => c.status === 'banned').length;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        unreadResponsesCount={unreadResponsesCount}
        activeChipsCount={activeChipsCount}
        bannedChipsCount={bannedChipsCount}
        isEvolutionConnected={isEvolutionConnected}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onOpenAddChip={() => setIsAddChipOpen(true)}
          onOpenNewBatch={() => setIsBatchModalOpen(true)}
          onOpenWebhookModal={() => setIsWebhookModalOpen(true)}
          onOpenPostgresModal={() => setIsPostgresModalOpen(true)}
          onOpenEvolutionModal={() => setIsEvolutionModalOpen(true)}
          isEvolutionConnected={isEvolutionConnected}
          onTriggerBatchDispatch={() => handleTriggerSingleDispatch()}
          onOpenSettings={() => setIsSettingsOpen(true)}
          workerOn={Boolean(settings?.workerEnabled)}
          dbStatus={dbStatus}
        />

        {/* Viewport Content Container */}
        <main className="p-6 flex-1 max-w-7xl w-full mx-auto space-y-6">
          {currentTab === 'chips' && (
            <ChipsManagement
              chips={chips}
              onUpdateStatus={handleUpdateChipStatus}
              onDeleteChip={handleDeleteChip}
              onTestConnection={handleTestConnection}
              onOpenAddModal={() => setIsAddChipOpen(true)}
              onOpenEditProxy={(chip) => setEditingProxyChip(chip)}
              onOpenQrCode={(chip) => setQrChip(chip)}
            />
          )}

          {currentTab === 'campaigns' && (
            <CampaignsManagement
              batches={batches}
              templates={templates}
              chips={chips}
              leads={leads}
              onToggleBatchStatus={handleToggleBatchStatus}
              onDeleteBatch={handleDeleteBatch}
              onSaveTemplate={handleSaveTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onImportLeads={handleImportLeads}
              onOpenCreateBatch={() => setIsBatchModalOpen(true)}
              onTriggerSingleDispatch={() => handleTriggerSingleDispatch()}
            />
          )}

          {currentTab === 'health' && (
            <HealthDashboard
              chips={chips}
              telemetry={telemetry}
              onPromoteChip={(id) => handleUpdateChipStatus(id, 'active')}
              onNavigateToChips={() => setCurrentTab('chips')}
            />
          )}

          {currentTab === 'inbox' && (
            <ResponseInbox
              responses={responses}
              batches={batches}
              chips={chips}
              onMarkAsAttended={handleMarkAsAttended}
              onUpdateSentiment={handleUpdateSentiment}
              onSendQuickReply={handleSendQuickReply}
              onOpenWebhookModal={() => setIsWebhookModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <AddChipModal
        isOpen={isAddChipOpen}
        onClose={() => setIsAddChipOpen(false)}
        onAddChip={handleAddChip}
      />

      <EditProxyModal
        isOpen={!!editingProxyChip}
        onClose={() => setEditingProxyChip(null)}
        chip={editingProxyChip}
        onSaveProxy={handleSaveProxy}
      />

      <QRCodeModal
        isOpen={Boolean(qrChip)}
        onClose={() => setQrChip(null)}
        chip={qrChip}
        onOpenEvolutionConfig={() => setIsEvolutionModalOpen(true)}
        onSuccessConnected={() => refresh()}
        onToast={addToast}
      />

      <BatchModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        templates={templates}
        chips={chips}
        onCreateBatch={handleCreateBatch}
      />

      <EvolutionWebhookModal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        webhookUrl={webhookUrl}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        engine={engine}
        chips={chips}
        onSaved={refresh}
        onToast={addToast}
      />

      <PostgresModal
        isOpen={isPostgresModalOpen}
        onClose={() => setIsPostgresModalOpen(false)}
        dbStatus={dbStatus}
        onRefreshStatus={refreshDbStatus}
        onConnect={handleConnectPostgres}
        onRunMigration={handleRunMigration}
        onRunWorkerCycle={handleRunWorkerCycle}
      />

      <EvolutionModal
        isOpen={isEvolutionModalOpen}
        onClose={() => setIsEvolutionModalOpen(false)}
        onRefreshChips={refresh}
        webhookUrl={webhookUrl}
        onToast={addToast}
      />

      {/* Toast Feedback Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
