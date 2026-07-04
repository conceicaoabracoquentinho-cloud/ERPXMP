import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/common/States';
import { apiService } from '../services/apiService';
import { useToast } from '../contexts/ToastContext';
import { useSync } from '../contexts/SyncContext';
import { Download, FileSpreadsheet, File as FileJson, FileText, CircleCheck as CheckCircle2, Calendar, Clock, RefreshCw, Search, Plus, Play, Pause, Trash2, CreditCard as Edit3, Mail, Eye, ShieldCheck, Layers, HardDrive, Printer, X, Sparkles, Circle as HelpCircle, CircleAlert as AlertCircle, FileCode } from 'lucide-react';
import {
  formatCurrency,
  formatNumber,
  formatDate,
} from '../utils/formatters';
import {
  ExportDatasetId,
  ExportFormatId,
  ExportHistoryEntry,
  ExportSchedule,
} from '../types';
import {
  mapDataForExport,
  generateCSVBlob,
  generateJSONBlob,
  generateXLSXBlob,
  generatePDFDocumentHTML,
  triggerFileDownload,
} from '../utils/exportHelpers';
import { useAuditContext } from '../hooks/useAuditContext';

const DATASETS: {
  id: ExportDatasetId;
  label: string;
  description: string;
  icon: typeof Layers;
}[] = [
  { id: 'products', label: 'Catálogo de Produtos', description: 'SKUs, EANs, custos, estoques ERP/MP e divergências', icon: Layers },
  { id: 'orders', label: 'Vendas e Pedidos', description: 'Histórico de pedidos, clientes, fretes e comissões', icon: FileSpreadsheet },
  { id: 'finance', label: 'Lançamentos Financeiros', description: 'Receitas, taxas de marketplace, comissões e margens', icon: FileText },
  { id: 'alerts', label: 'Ocorrências e Alertas', description: 'Divergências detectadas, riscos financeiro e status de resolução', icon: AlertCircle },
  { id: 'conciliation', label: 'Conciliação Financeira', description: 'Extrato de repasses e divergências de pagamento', icon: CheckCircle2 },
  { id: 'audit', label: 'Trilha de Auditoria', description: 'Logs de governança, alterações de dados e acessos de usuários', icon: ShieldCheck },
  { id: 'connections', label: 'Conexões e Integrações', description: 'Status das APIs, latência, ERPs e Marketplaces integrados', icon: HardDrive },
];

const FORMATS: {
  id: ExportFormatId;
  label: string;
  ext: string;
  description: string;
  icon: typeof FileSpreadsheet;
  color: string;
  badgeColor: string;
}[] = [
  {
    id: 'csv',
    label: 'CSV (Planilha Universal)',
    ext: 'csv',
    description: 'Compatível com Excel, Numbers e Google Sheets (UTF-8 BOM)',
    icon: FileSpreadsheet,
    color: 'text-success-600 bg-success-50 dark:bg-success-950/60 border-success-200 dark:border-success-800',
    badgeColor: 'text-success-700 bg-success-100 dark:bg-success-900',
  },
  {
    id: 'xlsx',
    label: 'Excel (XLSX Formatado)',
    ext: 'xlsx',
    description: 'Planilha nativa com estilos de cabeçalho e tipos de células',
    icon: FileSpreadsheet,
    color: 'text-accent-600 bg-accent-50 dark:bg-accent-950/60 border-accent-200 dark:border-accent-800',
    badgeColor: 'text-accent-700 bg-accent-100 dark:bg-accent-900',
  },
  {
    id: 'json',
    label: 'JSON (Estruturado)',
    ext: 'json',
    description: 'Ideal para integrações, backups de dados e APIs REST',
    icon: FileJson,
    color: 'text-brand-600 bg-brand-50 dark:bg-brand-950/60 border-brand-200 dark:border-brand-800',
    badgeColor: 'text-brand-700 bg-brand-100 dark:bg-brand-900',
  },
  {
    id: 'pdf',
    label: 'Relatório PDF Oficial',
    ext: 'pdf',
    description: 'Documento impresso com cabeçalho de governança e totais',
    icon: FileText,
    color: 'text-danger-600 bg-danger-50 dark:bg-danger-950/60 border-danger-200 dark:border-danger-800',
    badgeColor: 'text-danger-700 bg-danger-100 dark:bg-danger-900',
  },
];

export const ExportsPage: React.FC = () => {
  const toast = useToast();
  const { refreshTrigger, notifyDataChanged } = useSync();
  const auditCtx = useAuditContext();

  // Primary State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<ExportDatasetId>('products');
  const [format, setFormat] = useState<ExportFormatId>('csv');
  const [observacao, setObservacao] = useState('');
  const [exporting, setExporting] = useState(false);

  // Loaded Data & History
  const [exportHistory, setExportHistory] = useState<ExportHistoryEntry[]>([]);
  const [schedules, setSchedules] = useState<ExportSchedule[]>([]);
  const [recordsCountMap, setRecordsCountMap] = useState<Record<ExportDatasetId, number>>({
    products: 0,
    orders: 0,
    finance: 0,
    alerts: 0,
    conciliation: 0,
    audit: 0,
    connections: 0,
  });

  // Filters & Search for History
  const [historySearch, setHistorySearch] = useState('');
  const [historyFormatFilter, setHistoryFormatFilter] = useState<string>('todos');

  // Modal States
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ExportSchedule | null>(null);
  const [scheduleFormData, setScheduleFormData] = useState({
    nome: '',
    dataset_id: 'orders' as ExportDatasetId,
    formato: 'xlsx' as ExportFormatId,
    frequencia: 'diario' as 'diario' | 'semanal' | 'mensal',
    horario: '08:00',
    email_destino: '',
  });

  const [deleteScheduleModal, setDeleteScheduleModal] = useState<ExportSchedule | null>(null);
  const [historyDetailModal, setHistoryDetailModal] = useState<ExportHistoryEntry | null>(null);
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState<{ html: string; title: string; datasetName: string } | null>(null);
  const [clearHistoryConfirmModal, setClearHistoryConfirmModal] = useState(false);

  // Load Data
  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyData, schedulesData, prods, ords, fins, alts, auds, conns] = await Promise.all([
        apiService.getExportHistory(),
        apiService.getExportSchedules(),
        apiService.getProducts(),
        apiService.getOrders(),
        apiService.getFinancialEntries(),
        apiService.getAlerts(),
        apiService.getAuditEntries(),
        apiService.getConnections(),
      ]);

      setExportHistory(historyData);
      setSchedules(schedulesData);

      setRecordsCountMap({
        products: prods.length,
        orders: ords.length,
        finance: fins.length,
        alerts: alts.length,
        conciliation: ords.length,
        audit: auds.length,
        connections: conns.length,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar módulo de exportações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData, refreshTrigger]);

  // Fetch Raw Dataset for Export
  const fetchRawDataset = async (datasetId: ExportDatasetId): Promise<{ data: any[]; name: string }> => {
    switch (datasetId) {
      case 'products':
        return { data: await apiService.getProducts(), name: 'Catálogo de Produtos' };
      case 'orders':
        return { data: await apiService.getOrders(), name: 'Vendas e Pedidos' };
      case 'finance':
        return { data: await apiService.getFinancialEntries(), name: 'Lançamentos Financeiros' };
      case 'alerts':
        return { data: await apiService.getAlerts(), name: 'Ocorrências e Alertas' };
      case 'conciliation': {
        const orders = await apiService.getOrders();
        return { data: orders, name: 'Conciliação Financeira' };
      }
      case 'audit':
        return { data: await apiService.getAuditEntries(), name: 'Trilha de Auditoria' };
      case 'connections':
        return { data: await apiService.getConnections(), name: 'Conexões e Integrações' };
      default:
        return { data: [], name: 'Dados' };
    }
  };

  // Perform Export & File Download
  const executeExport = async (targetDataset: ExportDatasetId, targetFormat: ExportFormatId, customObs?: string) => {
    setExporting(true);
    const startTime = Date.now();

    try {
      const { data, name } = await fetchRawDataset(targetDataset);
      const mapped = mapDataForExport(targetDataset, data);

      let blob: Blob;
      let textContent = '';
      const filename = `api2sheets-${targetDataset}-${Date.now()}.${targetFormat}`;

      if (targetFormat === 'csv') {
        const res = generateCSVBlob(mapped);
        blob = res.blob;
        textContent = res.text;
      } else if (targetFormat === 'json') {
        const res = generateJSONBlob(data);
        blob = res.blob;
        textContent = res.text;
      } else if (targetFormat === 'xlsx') {
        const res = generateXLSXBlob(mapped, name);
        blob = res.blob;
        textContent = res.text;
      } else {
        // PDF HTML document preview / download
        const html = generatePDFDocumentHTML(mapped, name, `Relatório de ${name}`);
        blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
        textContent = html;
      }

      const durationMs = Date.now() - startTime;
      const sizeBytes = blob.size || new Blob([textContent]).size;

      // Trigger Browser File Download
      if (targetFormat === 'pdf') {
        // Show PDF Preview Modal for PDF export
        setPdfPreviewHtml({ html: textContent, title: name, datasetName: name });
      } else {
        triggerFileDownload(blob, filename);
      }

      // Record in Export History
      const historyEntry = await apiService.addExportHistory({
        dataset: name,
        dataset_id: targetDataset,
        formato: targetFormat,
        usuario: auditCtx.usuario,
        registros: data.length,
        tamanho_bytes: sizeBytes,
        tempo_ms: durationMs,
        status: 'sucesso',
        observacao: customObs || observacao || 'Exportação efetuada via painel',
      });

      // Record in Audit Trail
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'exportacao_dados',
        modulo: 'Exportações',
        registro: `${name} (${targetFormat.toUpperCase()}) — ${data.length} registros`,
        antes: null,
        depois: `Arquivo: ${filename} | Tamanho: ${(sizeBytes / 1024).toFixed(1)} KB`,
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });

      toast.success(`Exportação de ${name} (${targetFormat.toUpperCase()}) realizada com sucesso!`);
      setObservacao('');
      notifyDataChanged();
    } catch {
      toast.error('Erro ao gerar arquivo de exportação. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  // Preview PDF Modal Handler
  const handlePreviewPDF = async () => {
    setExporting(true);
    try {
      const { data, name } = await fetchRawDataset(dataset);
      const mapped = mapDataForExport(dataset, data);
      const html = generatePDFDocumentHTML(mapped, name, `Relatório de ${name}`);
      setPdfPreviewHtml({ html, title: name, datasetName: name });
    } catch {
      toast.error('Erro ao gerar pré-visualização do PDF.');
    } finally {
      setExporting(false);
    }
  };

  // Schedule CRUD Handlers
  const handleOpenScheduleModal = (sch?: ExportSchedule) => {
    if (sch) {
      setEditingSchedule(sch);
      setScheduleFormData({
        nome: sch.nome,
        dataset_id: sch.dataset_id,
        formato: sch.formato,
        frequencia: sch.frequencia,
        horario: sch.horario,
        email_destino: sch.email_destino,
      });
    } else {
      setEditingSchedule(null);
      setScheduleFormData({
        nome: '',
        dataset_id: 'orders',
        formato: 'xlsx',
        frequencia: 'diario',
        horario: '08:00',
        email_destino: 'diretoria@empresa.com.br',
      });
    }
    setScheduleModalOpen(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleFormData.nome.trim()) {
      toast.error('Informe um nome para o agendamento.');
      return;
    }
    if (!scheduleFormData.email_destino.trim() || !scheduleFormData.email_destino.includes('@')) {
      toast.error('Informe um e-mail de destino válido.');
      return;
    }

    try {
      if (editingSchedule) {
        await apiService.updateExportSchedule(editingSchedule.id, scheduleFormData);
        await apiService.insertAudit({
          usuario: auditCtx.usuario,
          acao: 'edicao_agendamento_exportacao',
          modulo: 'Exportações',
          registro: scheduleFormData.nome,
          antes: editingSchedule.nome,
          depois: `${scheduleFormData.frequencia} - ${scheduleFormData.email_destino}`,
          ip: auditCtx.ip,
          navegador: auditCtx.navegador,
        });
        toast.success('Agendamento atualizado com sucesso!');
      } else {
        await apiService.createExportSchedule({
          ...scheduleFormData,
          ativo: true,
          ultima_execucao: null,
          proxima_execucao: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        });
        await apiService.insertAudit({
          usuario: auditCtx.usuario,
          acao: 'criacao_agendamento_exportacao',
          modulo: 'Exportações',
          registro: scheduleFormData.nome,
          antes: null,
          depois: `${scheduleFormData.frequencia} às ${scheduleFormData.horario} -> ${scheduleFormData.email_destino}`,
          ip: auditCtx.ip,
          navegador: auditCtx.navegador,
        });
        toast.success('Agendamento de exportação criado!');
      }
      setScheduleModalOpen(false);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao salvar agendamento.');
    }
  };

  const handleToggleSchedulePause = async (sch: ExportSchedule) => {
    try {
      const nextStatus = !sch.ativo;
      await apiService.updateExportSchedule(sch.id, { ativo: nextStatus });
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: nextStatus ? 'reativacao_agendamento' : 'pausa_agendamento',
        modulo: 'Exportações',
        registro: sch.nome,
        antes: sch.ativo ? 'Ativo' : 'Pausado',
        depois: nextStatus ? 'Ativo' : 'Pausado',
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });
      toast.success(`Agendamento "${sch.nome}" ${nextStatus ? 'reativado' : 'pausado'}.`);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao alterar status do agendamento.');
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteScheduleModal) return;
    try {
      await apiService.deleteExportSchedule(deleteScheduleModal.id);
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'exclusao_agendamento',
        modulo: 'Exportações',
        registro: deleteScheduleModal.nome,
        antes: 'Ativo',
        depois: 'Excluído',
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });
      toast.success('Agendamento excluído.');
      setDeleteScheduleModal(null);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao excluir agendamento.');
    }
  };

  const handleRunScheduleNow = async (sch: ExportSchedule) => {
    toast.info(`Executando agendamento "${sch.nome}"...`);
    await executeExport(sch.dataset_id, sch.formato, `Execução manual do agendamento: ${sch.nome}`);
    await apiService.updateExportSchedule(sch.id, {
      ultima_execucao: new Date().toISOString(),
    });
  };

  const handleClearHistory = async () => {
    try {
      await apiService.clearExportHistory();
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'limpeza_historico_exportacoes',
        modulo: 'Exportações',
        registro: 'Histórico de exportações limpo pelo usuário',
        antes: `${exportHistory.length} registros`,
        depois: '0 registros',
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });
      toast.success('Histórico de exportações limpo com sucesso.');
      setClearHistoryConfirmModal(false);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao limpar histórico de exportações.');
    }
  };

  // Filtered Export History List
  const filteredHistory = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    return exportHistory.filter((item) => {
      if (historyFormatFilter !== 'todos' && item.formato !== historyFormatFilter) return false;
      if (term) {
        const inDataset = item.dataset.toLowerCase().includes(term);
        const inUser = item.usuario.toLowerCase().includes(term);
        const inObs = item.observacao ? item.observacao.toLowerCase().includes(term) : false;
        if (!inDataset && !inUser && !inObs) return false;
      }
      return true;
    });
  }, [exportHistory, historySearch, historyFormatFilter]);

  // Derived KPI Stats
  const kpiStats = useMemo(() => {
    const totalCount = exportHistory.length;
    const totalRecordsExported = exportHistory.reduce((acc, h) => acc + h.registros, 0);
    const activeSchedulesCount = schedules.filter((s) => s.ativo).length;
    const lastEntry = exportHistory[0];

    return {
      totalCount,
      totalRecordsExported,
      activeSchedulesCount,
      lastExportText: lastEntry ? `${lastEntry.dataset} (${lastEntry.formato.toUpperCase()})` : 'Nenhuma',
      lastExportTime: lastEntry ? formatDate(lastEntry.criado_em) : '-',
    };
  }, [exportHistory, schedules]);

  if (loading) return <LoadingSpinner message="Carregando Módulo de Exportações e Rastreabilidade..." />;
  if (error) return <ErrorState message={error} onRetry={loadPageData} />;

  const selectedDatasetObj = DATASETS.find((d) => d.id === dataset)!;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Download className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            Central de Exportações, Relatórios & Agendamentos
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gere relatórios oficiais em CSV, XLSX, JSON e PDF com total governança e rastreabilidade na auditoria.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPageData}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Atualizar Dados
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenScheduleModal()}
            icon={<Plus className="h-4 w-4" />}
          >
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Top Governance KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Download} title="Exportações Realizadas" value={formatNumber(kpiStats.totalCount)} status="neutral" />
        <StatCard icon={Layers} title="Registros Exportados" value={formatNumber(kpiStats.totalRecordsExported)} status="success" />
        <StatCard icon={Clock} title="Agendamentos Ativos" value={formatNumber(kpiStats.activeSchedulesCount)} status="warning" />
        <StatCard icon={CheckCircle2} title="Última Exportação" value={kpiStats.lastExportText} description={`Em: ${kpiStats.lastExportTime}`} status="neutral" />
      </div>

      {/* Section 1: Real-time Data Exporter */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Dataset Selection (5 cols) */}
        <Card title="1. Selecione o Conjunto de Dados" description="Escolha a fonte oficial para geração do arquivo" className="lg:col-span-5">
          <div className="space-y-2">
            {DATASETS.map((item) => {
              const Icon = item.icon;
              const isSelected = dataset === item.id;
              const count = recordsCountMap[item.id] ?? 0;

              return (
                <button
                  key={item.id}
                  onClick={() => setDataset(item.id)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/90 text-brand-900 shadow-sm dark:bg-brand-950/80 dark:border-brand-600 dark:text-brand-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isSelected
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{item.label}</span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {formatNumber(count)} registros
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Format & Export Controls (7 cols) */}
        <Card title="2. Escolha o Formato & Execute a Exportação" description="Selecione a extensão desejada e os parâmetros de download" className="lg:col-span-7 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Format Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FORMATS.map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = format === fmt.id;

                return (
                  <button
                    key={fmt.id}
                    onClick={() => setFormat(fmt.id)}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3.5 text-center transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/90 dark:bg-brand-950/80 dark:border-brand-600 shadow-sm ring-1 ring-brand-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${fmt.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">{fmt.label.split(' ')[0]}</span>
                      <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400">.{fmt.ext}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Format Summary Alert */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Conjunto Selecionado: <strong className="text-brand-600 dark:text-brand-400">{selectedDatasetObj.label}</strong>
                </span>
                <span className="text-xs text-slate-500">
                  Total em Tempo Real: <strong className="text-slate-800 dark:text-slate-200">{formatNumber(recordsCountMap[dataset])} itens</strong>
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {FORMATS.find((f) => f.id === format)?.description}
              </p>
            </div>

            {/* Optional Observation Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Observação de Governança (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Fechamento fiscal mensal, Auditoria interna, Conciliação Mês 06..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="input-base text-xs"
              />
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="mt-6 flex flex-wrap items-center justify-between border-t pt-4 dark:border-slate-800 gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4 text-success-600" />
              <span>Ação 100% auditável e rastreável na governança</span>
            </div>

            <div className="flex items-center gap-2">
              {format === 'pdf' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviewPDF}
                  loading={exporting}
                  icon={<Eye className="h-4 w-4 text-brand-600 dark:text-brand-400" />}
                >
                  Visualizar PDF
                </Button>
              )}

              <Button
                variant="primary"
                onClick={() => executeExport(dataset, format)}
                loading={exporting}
                icon={<Download className="h-4 w-4" />}
              >
                {exporting ? 'Gerando Arquivo...' : 'Exportar Dados Agora'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Section 2: Scheduled Automations (Agendamentos) */}
      <Card
        title="Agendamentos de Exportação Automática"
        description="Envio recorrente de relatórios por e-mail/webhook em horários programados"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenScheduleModal()}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Novo Agendamento
          </Button>
        }
      >
        {schedules.length === 0 ? (
          <EmptyState
            title="Nenhum agendamento cadastrado"
            description="Crie rotinas automáticas para receber relatórios de vendas e estoques periodicamente."
          />
        ) : (
          <div className="space-y-3">
            {schedules.map((sch) => {
              const ds = DATASETS.find((d) => d.id === sch.dataset_id);
              const fmt = FORMATS.find((f) => f.id === sch.formato);

              return (
                <div
                  key={sch.id}
                  className={`flex flex-col gap-3 rounded-xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
                    sch.ativo
                      ? 'bg-white border-slate-200 dark:bg-slate-950 dark:border-slate-800'
                      : 'bg-slate-50 border-slate-200 opacity-75 dark:bg-slate-900/40 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        sch.ativo
                          ? 'border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-400'
                          : 'border-slate-200 bg-slate-100 text-slate-400 dark:bg-slate-800'
                      }`}
                    >
                      <Calendar className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{sch.nome}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            sch.ativo
                              ? 'bg-success-100 text-success-800 dark:bg-success-950/80 dark:text-success-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {sch.ativo ? 'Ativo' : 'Pausado'}
                        </span>
                        <Badge label={fmt?.label.split(' ')[0] ?? sch.formato.toUpperCase()} color="text-brand-600" />
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          Conjunto: <strong className="text-slate-700 dark:text-slate-200">{ds?.label ?? sch.dataset_id}</strong>
                        </span>
                        <span>
                          Frequência: <strong className="text-slate-700 dark:text-slate-200">{sch.frequencia.toUpperCase()} às {sch.horario}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {sch.email_destino}
                        </span>
                      </div>

                      {sch.ultima_execucao && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          Última execução: {formatDate(sch.ultima_execucao)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRunScheduleNow(sch)}
                      title="Executar Agora e Gerar Download"
                      icon={<Play className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />}
                    >
                      Executar
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleSchedulePause(sch)}
                      title={sch.ativo ? 'Pausar Agendamento' : 'Reativar Agendamento'}
                      icon={sch.ativo ? <Pause className="h-3.5 w-3.5 text-amber-600" /> : <Play className="h-3.5 w-3.5 text-success-600" />}
                    >
                      {sch.ativo ? 'Pausar' : 'Reativar'}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenScheduleModal(sch)}
                      title="Editar Agendamento"
                      icon={<Edit3 className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />}
                    >
                      Editar
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteScheduleModal(sch)}
                      title="Excluir Agendamento"
                      icon={<Trash2 className="h-3.5 w-3.5 text-danger-600" />}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Section 3: Export History & Audit Trail */}
      <Card
        title="Histórico de Exportações e Log de Governança"
        description="Registro em tempo real de todos os arquivos gerados pela equipe"
        action={
          exportHistory.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClearHistoryConfirmModal(true)}
              icon={<Trash2 className="h-3.5 w-3.5 text-danger-600" />}
              className="text-xs text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-950"
            >
              Limpar Histórico
            </Button>
          ) : undefined
        }
      >
        {/* Search & Filter Bar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por conjunto de dados, usuário ou observação..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="input-base pl-9 text-xs"
            />
            {historySearch && (
              <button
                onClick={() => setHistorySearch('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={historyFormatFilter}
              onChange={(e) => setHistoryFormatFilter(e.target.value)}
              className="input-base w-auto py-1.5 text-xs font-semibold"
            >
              <option value="todos">Todos Formatos</option>
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX</option>
              <option value="json">JSON</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
        </div>

        {/* History Table */}
        {filteredHistory.length === 0 ? (
          <EmptyState
            title="Nenhum histórico encontrado"
            description={
              historySearch || historyFormatFilter !== 'todos'
                ? 'Nenhum registro corresponde aos filtros selecionados.'
                : 'Realize uma exportação acima para registrar a primeira entrada no log de auditoria.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  <th className="py-3 px-3 font-bold">Data & Hora</th>
                  <th className="py-3 px-3 font-bold">Conjunto de Dados</th>
                  <th className="py-3 px-3 font-bold">Formato</th>
                  <th className="py-3 px-3 font-bold text-right">Registros</th>
                  <th className="py-3 px-3 font-bold text-right">Tamanho</th>
                  <th className="py-3 px-3 font-bold text-right">Tempo</th>
                  <th className="py-3 px-3 font-bold">Usuário</th>
                  <th className="py-3 px-3 font-bold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {filteredHistory.map((item) => {
                  const fmt = FORMATS.find((f) => f.id === item.formato);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(item.criado_em)}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                        {item.dataset}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${fmt?.badgeColor || 'bg-slate-100 text-slate-700'}`}>
                          {item.formato.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {formatNumber(item.registros)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">
                        {(item.tamanho_bytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">
                        {item.tempo_ms} ms
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {item.usuario}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => executeExport(item.dataset_id, item.formato, `Re-download do histórico (${item.id})`)}
                            title="Refazer Download Imediato"
                            className="p-1"
                          >
                            <Download className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setHistoryDetailModal(item)}
                            title="Ver Detalhes do Log"
                            className="p-1"
                          >
                            <Eye className="h-3.5 w-3.5 text-slate-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* MODAL: Create / Edit Schedule */}
      <Modal
        open={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        title={editingSchedule ? 'Editar Agendamento de Exportação' : 'Novo Agendamento Automático'}
        size="md"
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nome da Rotina / Agendamento *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Relatório Semanal de Vendas da Diretoria"
              value={scheduleFormData.nome}
              onChange={(e) => setScheduleFormData({ ...scheduleFormData, nome: e.target.value })}
              className="input-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Conjunto de Dados *
              </label>
              <select
                value={scheduleFormData.dataset_id}
                onChange={(e) => setScheduleFormData({ ...scheduleFormData, dataset_id: e.target.value as ExportDatasetId })}
                className="input-base"
              >
                {DATASETS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Formato do Arquivo *
              </label>
              <select
                value={scheduleFormData.formato}
                onChange={(e) => setScheduleFormData({ ...scheduleFormData, formato: e.target.value as ExportFormatId })}
                className="input-base"
              >
                <option value="csv">CSV (Planilha)</option>
                <option value="xlsx">Excel (XLSX)</option>
                <option value="json">JSON (Estruturado)</option>
                <option value="pdf">PDF (Relatório Oficial)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Frequência *
              </label>
              <select
                value={scheduleFormData.frequencia}
                onChange={(e) => setScheduleFormData({ ...scheduleFormData, frequencia: e.target.value as any })}
                className="input-base"
              >
                <option value="diario">Diário (Todos os dias)</option>
                <option value="semanal">Semanal (Segunda-feira)</option>
                <option value="mensal">Mensal (Dia 1 do mês)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Horário de Envio *
              </label>
              <input
                type="time"
                required
                value={scheduleFormData.horario}
                onChange={(e) => setScheduleFormData({ ...scheduleFormData, horario: e.target.value })}
                className="input-base"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              E-mail de Destino *
            </label>
            <input
              type="email"
              required
              placeholder="diretoria@empresa.com.br"
              value={scheduleFormData.email_destino}
              onChange={(e) => setScheduleFormData({ ...scheduleFormData, email_destino: e.target.value })}
              className="input-base"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4 dark:border-slate-800">
            <Button variant="outline" size="sm" type="button" onClick={() => setScheduleModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" type="submit">
              {editingSchedule ? 'Salvar Alterações' : 'Criar Agendamento'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Delete Schedule Confirmation */}
      <Modal
        open={!!deleteScheduleModal}
        onClose={() => setDeleteScheduleModal(null)}
        title="Confirmar Exclusão de Agendamento"
        size="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-700 dark:text-slate-300">
            Tem certeza de que deseja excluir o agendamento{' '}
            <strong className="text-slate-900 dark:text-slate-100">{deleteScheduleModal?.nome}</strong>? Essa ação é
            irreversível e interromperá os envios automáticos.
          </p>

          <div className="flex items-center justify-end gap-2 border-t pt-3 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setDeleteScheduleModal(null)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteSchedule}>
              Excluir Agendamento
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Clear History Confirmation */}
      <Modal
        open={clearHistoryConfirmModal}
        onClose={() => setClearHistoryConfirmModal(false)}
        title="Confirmar Limpeza de Histórico"
        size="sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-700 dark:text-slate-300">
            Deseja realmente limpar todos os registros do histórico de exportações? A ação será registrada na trilha de auditoria de governança.
          </p>

          <div className="flex items-center justify-end gap-2 border-t pt-3 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setClearHistoryConfirmModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" size="sm" onClick={handleClearHistory}>
              Limpar Todo o Histórico
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: History Item Detail */}
      <Modal
        open={!!historyDetailModal}
        onClose={() => setHistoryDetailModal(null)}
        title="Detalhes do Registro de Exportação"
        size="md"
      >
        {historyDetailModal && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl dark:bg-slate-900 border dark:border-slate-800">
              <div>
                <span className="text-slate-500">ID de Auditoria:</span>
                <p className="font-mono font-bold text-slate-800 dark:text-slate-200">{historyDetailModal.id}</p>
              </div>
              <div>
                <span className="text-slate-500">Data e Hora:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{formatDate(historyDetailModal.criado_em)}</p>
              </div>
              <div>
                <span className="text-slate-500">Conjunto de Dados:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{historyDetailModal.dataset}</p>
              </div>
              <div>
                <span className="text-slate-500">Formato:</span>
                <p className="font-bold text-brand-600">{historyDetailModal.formato.toUpperCase()}</p>
              </div>
              <div>
                <span className="text-slate-500">Registros Processados:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{formatNumber(historyDetailModal.registros)}</p>
              </div>
              <div>
                <span className="text-slate-500">Tamanho e Latência:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {(historyDetailModal.tamanho_bytes / 1024).toFixed(1)} KB ({historyDetailModal.tempo_ms} ms)
                </p>
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-bold block mb-1">Observação do Solicitante:</span>
              <p className="p-2.5 rounded-lg bg-white border text-slate-800 dark:bg-slate-950 dark:border-slate-800">
                {historyDetailModal.observacao || 'Nenhuma observação registrada.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setHistoryDetailModal(null)}>
                Fechar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  executeExport(historyDetailModal.dataset_id, historyDetailModal.formato, `Re-download via modal (${historyDetailModal.id})`);
                  setHistoryDetailModal(null);
                }}
                icon={<Download className="h-4 w-4" />}
              >
                Refazer Download
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: PDF Printable Preview */}
      <Modal
        open={!!pdfPreviewHtml}
        onClose={() => setPdfPreviewHtml(null)}
        title={`Pré-visualização do Relatório - ${pdfPreviewHtml?.title}`}
        size="lg"
      >
        {pdfPreviewHtml && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
              <span className="text-slate-500">
                Documento de Governança Formatado para Impressão e PDF
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(pdfPreviewHtml.html);
                      printWindow.document.close();
                      printWindow.focus();
                      setTimeout(() => printWindow.print(), 300);
                    }
                  }}
                  icon={<Printer className="h-4 w-4" />}
                >
                  Imprimir / Salvar PDF
                </Button>
              </div>
            </div>

            {/* Render HTML Document Frame */}
            <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-300 bg-white p-4 text-slate-900 shadow-inner">
              <div dangerouslySetInnerHTML={{ __html: pdfPreviewHtml.html }} />
            </div>

            <div className="flex items-center justify-end border-t pt-3 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setPdfPreviewHtml(null)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
