import React, { useState, useRef } from 'react';
import { Batch, Lead } from '../../types';
import { formatPhoneBR, cleanPhone } from '../../utils/spintax';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  Users,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface LeadUploaderProps {
  batches: Batch[];
  onImportLeads: (batchId: string, leads: Omit<Lead, 'id'>[]) => void;
  onOpenCreateBatch: () => void;
}

interface ParsedLeadRow {
  name: string;
  city: string;
  phone: string;
  company?: string;
  isValid: boolean;
  error?: string;
}

export const LeadUploader: React.FC<LeadUploaderProps> = ({
  batches,
  onImportLeads,
  onOpenCreateBatch,
}) => {
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id || '');
  const [parsedRows, setParsedRows] = useState<ParsedLeadRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeBatches = batches.filter((b) => b.status !== 'completed');

  const processCSVText = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return;

    // Detect delimiter (, or ;)
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';
    const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase());

    // Map column indices
    let nameIdx = headers.findIndex((h) => h.includes('nome') || h.includes('name'));
    let cityIdx = headers.findIndex((h) => h.includes('cidade') || h.includes('city'));
    let phoneIdx = headers.findIndex((h) => h.includes('telefone') || h.includes('phone') || h.includes('celular') || h.includes('whatsapp') || h.includes('zap'));
    let companyIdx = headers.findIndex((h) => h.includes('empresa') || h.includes('company'));

    // Defaults if headers not matched standard names
    if (nameIdx === -1) nameIdx = 0;
    if (cityIdx === -1) cityIdx = 1;
    if (phoneIdx === -1) phoneIdx = 2;

    const results: ParsedLeadRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(delimiter).map((p) => p.trim());
      if (parts.length < 2) continue;

      const rawName = parts[nameIdx] || 'Lead Sem Nome';
      const rawCity = parts[cityIdx] || 'Não informada';
      const rawPhone = parts[phoneIdx] || '';
      const rawCompany = companyIdx !== -1 ? parts[companyIdx] : undefined;

      const digits = cleanPhone(rawPhone);
      const isValid = digits.length >= 10 && digits.length <= 13;

      results.push({
        name: rawName,
        city: rawCity,
        phone: isValid ? formatPhoneBR(digits) : rawPhone,
        company: rawCompany,
        isValid,
        error: !isValid ? 'Telefone inválido (deve conter DDD e 9 dígitos)' : undefined,
      });
    }

    setParsedRows(results);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      processCSVText(content);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      processCSVText(content);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!selectedBatchId) return;
    const validLeads = parsedRows
      .filter((r) => r.isValid)
      .map((r) => ({
        batchId: selectedBatchId,
        name: r.name,
        city: r.city,
        phone: r.phone,
        company: r.company,
        status: 'pending' as const,
      }));

    if (validLeads.length === 0) return;

    onImportLeads(selectedBatchId, validLeads);
    setParsedRows([]);
    setFileName(null);
  };

  const handleLoadDemoLeads = () => {
    const demoCsv = `Nome,Cidade,Telefone,Empresa
Lucas Andrade,São Paulo,11984210982,Andrade Logística
Beatriz Mendes,Curitiba,41991238491,Mendes & Associados
Carlos Eduardo,Belo Horizonte,31987654321,Eduardo Tech
Fernanda Lima,Campinas,19998812345,Nutrição Viva
Gustavo Rocha,Rio de Janeiro,21981234567,Rocha Engenharia
Mariana Souza,Porto Alegre,51996541234,Souza Arquitetura
Thiago Martins,Salvador,71987123984,Bahia Solar
Julio César,Florianópolis,48991827364,Ilha Inovação
Amanda Ribeiro,Brasília,61984556677,Capital Consultoria
Vinicius Ramos,Goiânia,62991122334,AgroRamos`;

    setFileName('leads_prospeccao_brasil_demo.csv');
    processCSVText(demoCsv);
  };

  const handleDownloadSampleCSV = () => {
    const sample = `Nome,Cidade,Telefone,Empresa
Rodrigo Silva,São Paulo,11981234567,Nexus Tech
Camila Fernandes,Campinas,19997654321,Alvorada Distribuidora
Marcelo Rezende,Santo André,11976543210,Rezende & Filhos`;

    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_leads_zappulse.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="space-y-6">
      {/* Configuration bar: Choose batch & actions */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Vincular ao Lote de Disparo</span>
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500/60"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.totalLeads} leads atuais · {b.status.toUpperCase()})
                </option>
              ))}
            </select>
            <button
              onClick={onOpenCreateBatch}
              className="px-3 py-2 text-xs font-medium rounded-lg text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors whitespace-nowrap"
            >
              + Novo Lote
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownloadSampleCSV}
            className="px-3 py-2 text-xs font-medium rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar Planilha Modelo</span>
          </button>
          <button
            onClick={handleLoadDemoLeads}
            className="px-3 py-2 text-xs font-medium rounded-lg text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-800/80 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Carregar 10 Leads Demo</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-8 border-2 border-dashed rounded-xl cursor-pointer text-center transition-all ${
          isDragging
            ? 'border-emerald-500 bg-emerald-500/5'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/20 hover:bg-slate-900/40'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".csv,.txt"
          className="hidden"
        />
        <div className="max-w-md mx-auto space-y-2">
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/80 mx-auto flex items-center justify-center text-slate-300">
            <UploadCloud className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-white">
            {fileName ? fileName : 'Arraste seu arquivo CSV ou clique para selecionar'}
          </p>
          <p className="text-xs text-slate-400">
            Colunas obrigatórias: <strong className="text-slate-300">Nome</strong>,{' '}
            <strong className="text-slate-300">Cidade</strong> e{' '}
            <strong className="text-slate-300">Telefone</strong> (com DDD). Suporta delimitador vírgula ou ponto-e-vírgula.
          </p>
        </div>
      </div>

      {/* Parsed Results Preview */}
      {parsedRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-white">Arquivo: {fileName}</span>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-400 font-mono font-medium">
                {validCount} válidos para importação
              </span>
              {invalidCount > 0 && (
                <>
                  <span className="text-slate-600">·</span>
                  <span className="text-rose-400 font-mono">{invalidCount} inválidos</span>
                </>
              )}
            </div>

            <button
              onClick={handleConfirmImport}
              disabled={validCount === 0 || !selectedBatchId}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-400 text-slate-950 hover:bg-emerald-300 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-500/20"
            >
              <span>Vincular {validCount} Leads ao Lote</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Nome do Lead</th>
                    <th className="py-2.5 px-3">Cidade</th>
                    <th className="py-2.5 px-3">Telefone Formatado</th>
                    <th className="py-2.5 px-3">Empresa</th>
                    <th className="py-2.5 px-3">Status Validação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {parsedRows.map((row, idx) => (
                    <tr
                      key={idx}
                      className={row.isValid ? 'hover:bg-slate-800/30' : 'bg-rose-950/10'}
                    >
                      <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 font-medium text-slate-200">{row.name}</td>
                      <td className="py-2 px-3 text-slate-400">{row.city}</td>
                      <td className="py-2 px-3 font-mono text-slate-300">{row.phone}</td>
                      <td className="py-2 px-3 text-slate-400">{row.company || '-'}</td>
                      <td className="py-2 px-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Válido</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{row.error}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
