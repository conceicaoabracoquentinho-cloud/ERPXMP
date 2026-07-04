import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/common/States';
import { apiService } from '../services/apiService';
import { useToast } from '../contexts/ToastContext';
import { useSync } from '../contexts/SyncContext';
import { BellRing, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Eye, Lightbulb, Check, X, Search, RefreshCw, RotateCcw, DollarSign, ArrowUpDown, Zap, ShieldCheck, CheckCheck, Layers, Clock } from 'lucide-react';
import {
  formatCurrency,
  formatNumber,
  formatDate,
} from '../utils/formatters';
import { SEVERITY_COLORS } from '../config/constants';
import { useAuditContext } from '../hooks/useAuditContext';
import { Alert, AlertSeverity, AlertStatus, AuditEntry } from '../types';

const STATUS_LABELS: Record<AlertStatus, string> = {
  detectado: 'Detectado',
  em_analise: 'Em análise',
  em_correcao: 'Em correção',
  resolvido: 'Resolvido',
  arquivado: 'Arquivado',
};

interface AlertsPageProps {
  initialSelectedId?: string | null;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ initialSelectedId }) => {
  const toast = useToast();
  const { refreshTrigger, notifyDataChanged } = useSync();
  const auditCtx = useAuditContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);

  // Filters & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('todos');
  const [moduleFilter, setModuleFilter] = useState<string>('todos');
  const [originFilter, setOriginFilter] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [periodFilter, setPeriodFilter] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<string>('mais_recentes');

  // Interactive & Modal State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [batchResolving, setBatchResolving] = useState(false);
  const [resolvingAll, setResolvingAll] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [viewAlert, setViewAlert] = useState<Alert | null>(null);
  const [resolveAllConfirmOpen, setResolveAllConfirmOpen] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [altsData, auditData] = await Promise.all([
        apiService.getAlerts(),
        apiService.getAuditEntries(),
      ]);
      setAlerts(altsData);
      setAuditLogs(auditData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar alertas do sistema');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts, refreshTrigger]);

  useEffect(() => {
    if (initialSelectedId && alerts.length > 0) {
      const found = alerts.find((a) => a.id === initialSelectedId);
      if (found) {
        setSearchTerm('');
        setStatusFilter('todos');
        setSeverityFilter('todos');
        setModuleFilter('todos');
        setOriginFilter('todos');
        setPeriodFilter('todos');
        setViewAlert(found);
      }
    }
  }, [initialSelectedId, alerts]);

  // Derived Statistics
  const stats = useMemo(() => {
    const active = alerts.filter((a) => a.status !== 'resolvido');
    const resolved = alerts.filter((a) => a.status === 'resolvido');
    const critico = active.filter((a) => a.severidade === 'critico').length;
    const alto = active.filter((a) => a.severidade === 'alto').length;
    const medio = active.filter((a) => a.severidade === 'medio').length;
    const baixo = active.filter((a) => a.severidade === 'baixo').length;
    const informativo = active.filter((a) => a.severidade === 'informativo').length;
    const impacto = active.reduce((acc, a) => acc + Number(a.impacto_financeiro), 0);

    return {
      totalActive: active.length,
      totalResolved: resolved.length,
      critico,
      alto,
      medio,
      baixo,
      informativo,
      impacto,
    };
  }, [alerts]);

  // Unique Lists for Dropdowns
  const modules = useMemo(() => {
    return Array.from(new Set(alerts.map((a) => a.modulo))).sort();
  }, [alerts]);

  const origins = useMemo(() => {
    return Array.from(new Set(alerts.map((a) => a.origem))).sort();
  }, [alerts]);

  // Accent and Case Normalization
  const normalizeText = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  // Filtered & Sorted Alerts List
  const filteredAlerts = useMemo(() => {
    const term = normalizeText(searchTerm.trim());
    const now = new Date();

    return alerts
      .filter((a) => {
        // Search Term Matching
        if (term) {
          const inTitle = normalizeText(a.titulo).includes(term);
          const inMessage = normalizeText(a.mensagem).includes(term);
          const inOrigin = normalizeText(a.origem).includes(term);
          const inModule = normalizeText(a.modulo).includes(term);
          const inType = normalizeText(a.tipo).includes(term);
          const inSuggestion = a.sugestao ? normalizeText(a.sugestao).includes(term) : false;
          const inResp = a.responsavel ? normalizeText(a.responsavel).includes(term) : false;

          if (!inTitle && !inMessage && !inOrigin && !inModule && !inType && !inSuggestion && !inResp) {
            return false;
          }
        }

        // Severity Filter
        if (severityFilter !== 'todos' && a.severidade !== severityFilter) return false;

        // Module Filter
        if (moduleFilter !== 'todos' && a.modulo !== moduleFilter) return false;

        // Origin Filter
        if (originFilter !== 'todos' && a.origem !== originFilter) return false;

        // Status Filter
        if (statusFilter !== 'todos' && a.status !== statusFilter) return false;

        // Period Filter
        if (periodFilter !== 'todos') {
          const createdDate = new Date(a.criado_em);
          const diffHours = (now.getTime() - createdDate.getTime()) / (1000 * 3600);
          if (periodFilter === 'hoje' && diffHours > 24) return false;
          if (periodFilter === '7dias' && diffHours > 24 * 7) return false;
          if (periodFilter === '30dias' && diffHours > 24 * 30) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'mais_recentes') {
          return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
        }
        if (sortBy === 'mais_antigos') {
          return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
        }
        if (sortBy === 'maior_impacto') {
          return Number(b.impacto_financeiro) - Number(a.impacto_financeiro);
        }
        if (sortBy === 'maior_severidade') {
          const sevRank: Record<AlertSeverity, number> = {
            critico: 5,
            alto: 4,
            medio: 3,
            baixo: 2,
            informativo: 1,
          };
          return (sevRank[b.severidade] ?? 0) - (sevRank[a.severidade] ?? 0);
        }
        return 0;
      });
  }, [alerts, searchTerm, severityFilter, moduleFilter, originFilter, statusFilter, periodFilter, sortBy]);

  // Unresolved items among currently filtered
  const visibleUnresolvedAlerts = useMemo(() => {
    return filteredAlerts.filter((a) => a.status !== 'resolvido');
  }, [filteredAlerts]);

  // Handlers
  const handleReconcileNow = async () => {
    setReconciling(true);
    try {
      const res = await apiService.reconcileSystemAlerts();
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'reconciliacao_alertas_sistema',
        modulo: 'Alertas',
        registro: `${res.totalDetected} divergências detectadas em tempo real`,
        antes: null,
        depois: 'Reconciliação Concluída',
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });
      toast.success(`Reconciliação concluída! ${res.totalDetected} alertas/divergências ativos verificados.`);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao executar reconciliação de alertas.');
    } finally {
      setReconciling(false);
    }
  };

  const handleResolveSingle = async (alert: Alert) => {
    setResolvingId(alert.id);
    try {
      await apiService.resolveAlert(alert.id, auditCtx.usuario);
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'resolucao_alerta',
        modulo: 'Alertas',
        registro: alert.titulo,
        antes: alert.status,
        depois: 'resolvido',
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });
      toast.success('Alerta resolvido com sucesso.');
      notifyDataChanged();
    } catch {
      toast.error('Erro ao resolver alerta.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleResolveBatch = async () => {
    if (selectedIds.size === 0) return;
    setBatchResolving(true);
    try {
      const idsArray: string[] = Array.from(selectedIds);
      await apiService.resolveAlertsBatch(idsArray, auditCtx.usuario);
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'resolucao_lote_alertas',
        modulo: 'Alertas',
        registro: `${idsArray.length} alertas resolvidos em lote`,
        antes: 'detectado',
        depois: 'resolvido',
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });
      toast.success(`${idsArray.length} alertas resolvidos com sucesso.`);
      setSelectedIds(new Set());
      notifyDataChanged();
    } catch {
      toast.error('Erro ao resolver alertas em lote.');
    } finally {
      setBatchResolving(false);
    }
  };

  const handleResolveAll = async () => {
    setResolvingAll(true);
    try {
      const count = await apiService.resolveAllAlerts(auditCtx.usuario);
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'resolucao_total_alertas',
        modulo: 'Alertas',
        registro: `${count} alertas resolvidos (Limpeza Total)`,
        antes: 'Ativos',
        depois: 'Resolvidos',
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });
      toast.success(`Todos os ${count} alertas ativos foram resolvidos.`);
      setSelectedIds(new Set());
      notifyDataChanged();
    } catch {
      toast.error('Erro ao resolver todos os alertas.');
    } finally {
      setResolvingAll(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const unresolvedIds = visibleUnresolvedAlerts.map((a) => a.id);
    const allSelected = unresolvedIds.every((id) => selectedIds.has(id));

    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        unresolvedIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        unresolvedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSeverityFilter('todos');
    setModuleFilter('todos');
    setOriginFilter('todos');
    setStatusFilter('todos');
    setPeriodFilter('todos');
    setSortBy('mais_recentes');
  };

  const isFiltersActive =
    searchTerm !== '' ||
    severityFilter !== 'todos' ||
    moduleFilter !== 'todos' ||
    originFilter !== 'todos' ||
    statusFilter !== 'todos' ||
    periodFilter !== 'todos' ||
    sortBy !== 'mais_recentes';

  if (loading) return <LoadingSpinner message="Carregando Central de Alertas e Auditoria..." />;
  if (error) return <ErrorState message={error} onRetry={loadAlerts} />;

  return (
    <div className="space-y-6">
      {/* Page Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            Central de Alertas & Conciliação em Tempo Real
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitoramento proativo e rastreabilidade total de divergências de estoque, preços e pagamentos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReconcileNow}
            loading={reconciling}
            icon={<Zap className="h-4 w-4 text-brand-600 dark:text-brand-400" />}
          >
            Reconciliar em Tempo Real
          </Button>

          {stats.totalActive > 0 && (
            <Button
              variant="success"
              size="sm"
              onClick={() => setResolveAllConfirmOpen(true)}
              loading={resolvingAll}
              icon={<CheckCheck className="h-4 w-4" />}
            >
              Resolver Todos ({stats.totalActive})
            </Button>
          )}
        </div>
      </div>

      {/* Top Severity KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard icon={BellRing} title="Alertas Críticos" value={formatNumber(stats.critico)} status="danger" />
        <StatCard icon={AlertTriangle} title="Alertas Altos" value={formatNumber(stats.alto)} status="warning" />
        <StatCard icon={Layers} title="Alertas Ativos" value={formatNumber(stats.totalActive)} status="neutral" />
        <StatCard icon={DollarSign} title="Risco Financeiro" value={formatCurrency(stats.impacto)} status="danger" />
        <StatCard icon={CheckCircle2} title="Total Resolvidos" value={formatNumber(stats.totalResolved)} status="success" />
      </div>

      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-950/80 shadow-sm animate-slide-in">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-brand-700 dark:text-brand-300">
              {selectedIds.size} alerta(s) selecionado(s)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="success"
              size="sm"
              onClick={handleResolveBatch}
              loading={batchResolving}
              icon={<Check className="h-3.5 w-3.5" />}
            >
              Resolver Selecionados ({selectedIds.size})
            </Button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-brand-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-brand-900"
              title="Cancelar seleção"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Control Panel: Search & Filters */}
      <Card className="p-4 space-y-4">
        {/* Row 1: Search & Sort */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por título, mensagem, SKU, pedido, marketplace, módulo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-base pl-9 text-xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-base w-auto py-1.5 text-xs font-medium"
            >
              <option value="mais_recentes">Mais Recentes</option>
              <option value="mais_antigos">Mais Antigos</option>
              <option value="maior_impacto">Maior Risco Financeiro</option>
              <option value="maior_severidade">Maior Severidade</option>
            </select>
          </div>
        </div>

        {/* Row 2: Severity Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t dark:border-slate-800">
          {[
            { id: 'todos', label: 'Todos', count: alerts.length },
            { id: 'critico', label: 'Crítico', count: stats.critico },
            { id: 'alto', label: 'Alto', count: stats.alto },
            { id: 'medio', label: 'Médio', count: stats.medio },
            { id: 'baixo', label: 'Baixo', count: stats.baixo },
            { id: 'informativo', label: 'Informativo', count: stats.informativo },
          ].map((sev) => {
            const isSelected = severityFilter === sev.id;
            return (
              <button
                key={sev.id}
                onClick={() => setSeverityFilter(sev.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'border bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span>{sev.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {sev.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Dropdown Selectors */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t dark:border-slate-800">
          {/* Module */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="input-base w-auto py-1 text-xs"
          >
            <option value="todos">Módulo: Todos</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Origin */}
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value)}
            className="input-base w-auto py-1 text-xs"
          >
            <option value="todos">Origem: Todas</option>
            {origins.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base w-auto py-1 text-xs"
          >
            <option value="todos">Status: Todos</option>
            <option value="detectado">Detectado</option>
            <option value="em_analise">Em Análise</option>
            <option value="em_correcao">Em Correção</option>
            <option value="resolvido">Resolvido</option>
          </select>

          {/* Period */}
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="input-base w-auto py-1 text-xs"
          >
            <option value="todos">Período: Todo o histórico</option>
            <option value="hoje">Últimas 24h</option>
            <option value="7dias">Últimos 7 dias</option>
            <option value="30dias">Últimos 30 dias</option>
          </select>

          {/* Select All Visible Checkbox */}
          {visibleUnresolvedAlerts.length > 0 && (
            <button
              onClick={toggleSelectAllVisible}
              className="ml-auto btn-ghost py-1 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-semibold"
            >
              {visibleUnresolvedAlerts.every((a) => selectedIds.has(a.id))
                ? 'Desmarcar Todos'
                : `Marcar Todos (${visibleUnresolvedAlerts.length})`}
            </button>
          )}

          {/* Clear Filters Button */}
          {isFiltersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400"
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      </Card>

      {/* Alert List */}
      {filteredAlerts.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum alerta ou divergência encontrada"
            description={
              isFiltersActive
                ? 'Tente remover os filtros ou alterar os termos de busca para visualizar os alertas.'
                : 'Excelente! O sistema não encontrou divergências pendentes no momento.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const sev = SEVERITY_COLORS[alert.severidade] ?? SEVERITY_COLORS.informativo;
            const isChecked = selectedIds.has(alert.id);
            const isResolving = resolvingId === alert.id;

            return (
              <Card
                key={alert.id}
                hover
                className={`border-l-4 transition-all ${sev.bg} ${
                  alert.status === 'resolvido' ? 'opacity-85' : ''
                }`}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    {alert.status !== 'resolvido' && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(alert.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                    )}
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${sev.dot}`} />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{alert.titulo}</h3>
                        <Badge label={sev.label} color={sev.color} />
                        <Badge
                          label={STATUS_LABELS[alert.status] ?? alert.status}
                          color={alert.status === 'resolvido' ? 'text-success-700 bg-success-50 dark:bg-success-950/60' : 'text-slate-600 dark:text-slate-300'}
                        />
                      </div>

                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{alert.mensagem}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          Origem: <strong className="text-slate-700 dark:text-slate-200">{alert.origem}</strong>
                        </span>
                        <span>
                          Módulo: <strong className="text-slate-700 dark:text-slate-200">{alert.modulo}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(alert.criado_em)}
                        </span>
                        {alert.responsavel && (
                          <span>
                            Resolvido por: <strong className="text-slate-700 dark:text-slate-200">{alert.responsavel}</strong>
                          </span>
                        )}
                      </div>

                      {alert.impacto_financeiro > 0 && (
                        <p className="mt-2 text-xs font-bold text-danger-600 dark:text-danger-400 flex items-center gap-1">
                          <DollarSign className="h-3.5 w-3.5" />
                          Risco Financeiro Estimado: {formatCurrency(Number(alert.impacto_financeiro))}
                        </p>
                      )}

                      {alert.sugestao && (
                        <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-brand-50/80 p-2.5 dark:bg-brand-950/60 border border-brand-100 dark:border-brand-900">
                          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                          <p className="text-xs font-medium text-brand-800 dark:text-brand-200">{alert.sugestao}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end lg:self-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewAlert(alert)}
                      title="Detalhes e Rastreabilidade"
                      className="p-1.5"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {alert.status === 'resolvido' ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-success-50 px-2.5 py-1 text-xs font-bold text-success-600 dark:bg-success-950/60 dark:text-success-400">
                        <CheckCircle2 className="h-4 w-4" /> Resolvido
                      </span>
                    ) : (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleResolveSingle(alert)}
                        loading={isResolving}
                        icon={<Check className="h-3.5 w-3.5" />}
                      >
                        {isResolving ? 'Resolvendo...' : 'Resolver'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Details & Traceability Modal */}
      <Modal
        open={!!viewAlert}
        onClose={() => setViewAlert(null)}
        title={viewAlert?.titulo ?? 'Detalhes do Alerta'}
        size="lg"
      >
        {viewAlert && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2 border-b pb-3 dark:border-slate-800">
              <Badge
                label={(SEVERITY_COLORS[viewAlert.severidade] ?? SEVERITY_COLORS.informativo).label}
                color={(SEVERITY_COLORS[viewAlert.severidade] ?? SEVERITY_COLORS.informativo).color}
              />
              <Badge label={STATUS_LABELS[viewAlert.status] ?? viewAlert.status} color="text-slate-600" />
              <Badge label={`Módulo: ${viewAlert.modulo}`} color="text-brand-600" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl dark:bg-slate-900 border dark:border-slate-800">
              <DetailRow label="ID de Rastreabilidade" value={<code className="font-mono text-[11px]">{viewAlert.id}</code>} />
              <DetailRow label="Tipo de Evento" value={viewAlert.tipo} />
              <DetailRow label="Canal / Origem" value={viewAlert.origem} />
              <DetailRow label="Data de Detecção" value={formatDate(viewAlert.criado_em)} />
              {viewAlert.resolvido_em && <DetailRow label="Data de Resolução" value={formatDate(viewAlert.resolvido_em)} />}
              {viewAlert.responsavel && <DetailRow label="Resolvido por" value={viewAlert.responsavel} />}
              {viewAlert.impacto_financeiro > 0 && (
                <DetailRow label="Risco Financeiro Estimado" value={<strong className="text-danger-600">{formatCurrency(Number(viewAlert.impacto_financeiro))}</strong>} />
              )}
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Descrição Detalhada do Problema</p>
              <p className="mt-1 text-slate-800 dark:text-slate-200 leading-relaxed bg-white p-3 rounded-xl border dark:bg-slate-950 dark:border-slate-800">
                {viewAlert.mensagem}
              </p>
            </div>

            {viewAlert.sugestao && (
              <div className="flex items-start gap-2.5 rounded-xl bg-brand-50 p-3 dark:bg-brand-950/80 border border-brand-200 dark:border-brand-800">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
                <div>
                  <p className="text-xs font-bold text-brand-800 dark:text-brand-200">Recomendação da Engine de Conciliação</p>
                  <p className="mt-0.5 text-xs text-brand-700 dark:text-brand-300">{viewAlert.sugestao}</p>
                </div>
              </div>
            )}

            {/* Audit Trail for this Alert */}
            <div className="border-t pt-3 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Histórico e Auditoria Relacionada
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1.5 text-xs">
                {auditLogs
                  .filter((a) => a.registro.includes(viewAlert.titulo) || a.modulo === 'Alertas')
                  .slice(0, 5)
                  .map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border dark:border-slate-800 text-[11px]">
                      <span>
                        <strong className="text-slate-700 dark:text-slate-300">{log.usuario}</strong> ({log.acao})
                      </span>
                      <span className="text-slate-400">{formatDate(log.criado_em)}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t pt-3 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setViewAlert(null)}>
                Fechar
              </Button>
              {viewAlert.status !== 'resolvido' && (
                <Button
                  variant="success"
                  size="sm"
                  loading={resolvingId === viewAlert.id}
                  disabled={resolvingId === viewAlert.id}
                  onClick={async () => {
                    await handleResolveSingle(viewAlert);
                    setViewAlert(null);
                  }}
                  icon={<Check className="h-4 w-4" />}
                >
                  Resolver Alerta
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={resolveAllConfirmOpen}
        onClose={() => setResolveAllConfirmOpen(false)}
        onConfirm={async () => { await handleResolveAll(); setResolveAllConfirmOpen(false); }}
        title="Resolver Todos os Alertas"
        message={`Esta ação irá resolver TODOS os ${stats.totalActive} alertas ativos no sistema. Esta operação não pode ser desfeita. Deseja continuar?`}
        confirmLabel="Sim, Resolver Todos"
        variant="danger"
      />
    </div>
  );
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-slate-500 dark:text-slate-400">{label}:</span>
      <span className="font-semibold text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  );
}
