import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { BarChart } from '../components/common/BarChart';
import { DonutChart } from '../components/common/DonutChart';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/common/States';
import { apiService } from '../services/apiService';
import { useSync } from '../contexts/SyncContext';
import { Package, ShoppingCart, TriangleAlert as AlertTriangle, DollarSign, Plug, BellRing, CircleCheck as CheckCircle2, Zap, TrendingUp } from 'lucide-react';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatTime,
  formatDate,
} from '../utils/formatters';
import {
  SEVERITY_COLORS,
  STATUS_CONNECTION_CONFIG,
  CONNECTION_TYPE_LABELS,
} from '../config/constants';
import { Product, Order, Alert, Connection, AuditEntry } from '../types';

interface DashboardPageProps {
  onNavigate?: (module: string, entityId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { refreshTrigger } = useSync();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, ords, alts, conns, auds] = await Promise.all([
        apiService.getProducts(),
        apiService.getOrders(),
        apiService.getAlerts(),
        apiService.getConnections(),
        apiService.getAuditEntries(),
      ]);
      setProducts(prods);
      setOrders(ords);
      setAlerts(alts);
      setConnections(conns);
      setAuditEntries(auds);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do Dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const metrics = useMemo(() => {
    const totalProds = products.length;
    const prodsConciliados = products.filter((p) => p.conciliacao === 'conciliado').length;
    const prodsDivergentes = products.filter((p) => p.conciliacao !== 'conciliado').length;

    const totalOrds = orders.length;
    const ordsConciliados = orders.filter((o) => o.conciliacao === 'conciliado').length;
    const ordsDivergentes = orders.filter((o) => o.conciliacao !== 'conciliado').length;

    const receitaTotal = orders
      .filter((o) => o.status !== 'cancelado')
      .reduce((sum, o) => sum + Number(o.valor), 0);

    const apisAtivas = connections.filter((c) => c.status === 'online').length;
    const totalApis = connections.length;

    const totalItens = totalProds + totalOrds;
    const conciliadosItens = prodsConciliados + ordsConciliados;
    const taxaConciliacao = totalItens > 0 ? (conciliadosItens / totalItens) * 100 : 100;

    const alertasAtivos = alerts.filter((a) => a.status !== 'resolvido');
    const alertasCriticos = alertasAtivos.filter((a) => a.severidade === 'critico').length;

    const impactoTotal = alertasAtivos.reduce((sum, a) => sum + Number(a.impacto_financeiro), 0);

    const ultimaSync = connections
      .map((c) => c.ultima_sincronizacao)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] ?? null;

    return {
      totalProds,
      prodsConciliados,
      prodsDivergentes,
      totalOrds,
      ordsConciliados,
      ordsDivergentes,
      receitaTotal,
      apisAtivas,
      totalApis,
      taxaConciliacao,
      alertasAtivosCount: alertasAtivos.length,
      alertasCriticos,
      impactoTotal,
      ultimaSync,
    };
  }, [products, orders, connections, alerts]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((ord) => {
      if (ord.status !== 'cancelado') {
        const key = ord.marketplace || 'Outros';
        map.set(key, (map.get(key) || 0) + Number(ord.valor));
      }
    });
    return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
  }, [orders]);

  if (loading) return <LoadingSpinner message="Carregando Inteligência Operacional..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const statusEmpresa = metrics.alertasCriticos > 0
    ? { label: 'Atenção Operacional', color: 'text-warning-700 dark:text-warning-300', bg: 'bg-warning-50 dark:bg-warning-950' }
    : { label: 'Operação Saudável', color: 'text-success-700 dark:text-success-300', bg: 'bg-success-50 dark:bg-success-950' };

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Visão Executiva Geral</h2>
              <button
                onClick={() => onNavigate?.('alerts')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${statusEmpresa.bg} ${statusEmpresa.color}`}
              >
                <span className={`h-2 w-2 rounded-full ${metrics.alertasCriticos > 0 ? 'bg-warning-500' : 'bg-success-500'}`} />
                {statusEmpresa.label}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Última sincronização: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatTime(metrics.ultimaSync)}</span> ·
              Integrações: <button onClick={() => onNavigate?.('connections')} className="font-semibold text-slate-700 dark:text-slate-200 hover:underline">{metrics.apisAtivas} de {metrics.totalApis} ativas</button> ·
              Alertas críticos: <button onClick={() => onNavigate?.('alerts')} className="font-semibold text-danger-600 dark:text-danger-400 hover:underline">{metrics.alertasCriticos}</button>
            </p>
          </div>
          <div className="flex gap-6 border-t pt-3 lg:border-t-0 lg:pt-0">
            <button
              onClick={() => onNavigate?.('alerts')}
              className="text-right cursor-pointer hover:opacity-80 transition-opacity"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">Risco Financeiro Identificado</p>
              <p className="text-xl font-bold text-danger-600 dark:text-danger-400">{formatCurrency(metrics.impactoTotal)}</p>
            </button>
            <button
              onClick={() => onNavigate?.('conciliation')}
              className="text-right cursor-pointer hover:opacity-80 transition-opacity"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400">Conciliação Geral</p>
              <p className="text-xl font-bold text-success-600 dark:text-success-400">{formatPercent(metrics.taxaConciliacao)}</p>
            </button>
          </div>
        </div>
      </Card>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Package}
          title="Total de Produtos"
          value={formatNumber(metrics.totalProds)}
          variation={2.4}
          trend="alta"
          status="neutral"
          onClick={() => onNavigate?.('products')}
        />
        <StatCard
          icon={ShoppingCart}
          title="Pedidos Conciliados"
          value={formatNumber(metrics.ordsConciliados)}
          variation={5.1}
          trend="alta"
          status="success"
          onClick={() => onNavigate?.('orders')}
        />
        <StatCard
          icon={AlertTriangle}
          title="Produtos Divergentes"
          value={formatNumber(metrics.prodsDivergentes)}
          variation={-1.2}
          trend="baixa"
          status="warning"
          onClick={() => onNavigate?.('conciliation')}
        />
        <StatCard
          icon={DollarSign}
          title="Receita Bruta Total"
          value={formatCurrency(metrics.receitaTotal)}
          variation={12.0}
          trend="alta"
          status="success"
          onClick={() => onNavigate?.('finance')}
        />
        <StatCard
          icon={Plug}
          title="APIs Conectadas"
          value={`${metrics.apisAtivas}/${metrics.totalApis}`}
          status="neutral"
          onClick={() => onNavigate?.('connections')}
        />
        <StatCard
          icon={BellRing}
          title="Alertas Ativos"
          value={formatNumber(metrics.alertasAtivosCount)}
          variation={8.3}
          trend="alta"
          status="danger"
          onClick={() => onNavigate?.('alerts')}
        />
        <StatCard
          icon={CheckCircle2}
          title="Produtos Conciliados"
          value={formatNumber(metrics.prodsConciliados)}
          status="success"
          onClick={() => onNavigate?.('products')}
        />
        <StatCard
          icon={Zap}
          title="Pedidos Pendentes"
          value={formatNumber(orders.filter((o) => o.status === 'aguardando').length)}
          status="warning"
          onClick={() => onNavigate?.('orders')}
        />
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          title="Receita por Marketplace"
          description="Acumulado das vendas em R$"
          className="lg:col-span-2"
          actions={
            <button
              onClick={() => onNavigate?.('finance')}
              className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Ver Detalhes Financeiros
            </button>
          }
        >
          <div onClick={() => onNavigate?.('finance')} className="cursor-pointer">
            <BarChart data={chartData} color="bg-brand-500" formatValue={(v) => formatCurrency(v)} />
          </div>
        </Card>

        <Card
          title="Conciliação Geral"
          description="Proporção global de precisão"
          actions={
            <button
              onClick={() => onNavigate?.('conciliation')}
              className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Ir para Conciliação
            </button>
          }
        >
          <div onClick={() => onNavigate?.('conciliation')} className="flex flex-col items-center justify-center py-2 cursor-pointer hover:opacity-90">
            <DonutChart percent={metrics.taxaConciliacao} label="conciliado" />
            <div className="mt-4 grid w-full grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-success-50 p-2.5 dark:bg-success-950/40">
                <p className="text-sm font-bold text-success-700 dark:text-success-300">
                  {formatNumber(metrics.prodsConciliados + metrics.ordsConciliados)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Conciliados</p>
              </div>
              <div className="rounded-lg bg-danger-50 p-2.5 dark:bg-danger-950/40">
                <p className="text-sm font-bold text-danger-700 dark:text-danger-300">
                  {formatNumber(metrics.prodsDivergentes + metrics.ordsDivergentes)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Divergentes</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Connections & Alerts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active Integrations */}
        <Card
          title="Integrações Ativas"
          description="Status em tempo real das conexões"
          actions={
            <button
              onClick={() => onNavigate?.('connections')}
              className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Gerenciar Conexões <TrendingUp className="h-3.5 w-3.5" />
            </button>
          }
        >
          {connections.length === 0 ? (
            <EmptyState title="Nenhuma integração cadastrada" description="Cadastre conexões no módulo de Integrações." />
          ) : (
            <div className="space-y-3">
              {connections.slice(0, 5).map((conn) => {
                const statusCfg = STATUS_CONNECTION_CONFIG[conn.status] ?? STATUS_CONNECTION_CONFIG.desativado;
                return (
                  <div
                    key={conn.id}
                    onClick={() => onNavigate?.('connections', conn.id)}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 hover:border-brand-400 hover:bg-slate-50/50 dark:hover:border-brand-600 dark:hover:bg-slate-800/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 rounded-full ${statusCfg.dot}`} />
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{conn.nome}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {CONNECTION_TYPE_LABELS[conn.tipo] ?? conn.tipo} · {formatNumber(conn.registros)} registros
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge label={statusCfg.label} color={statusCfg.color} />
                      <p className="mt-1 text-[10px] text-slate-400">{conn.tempo_resposta_ms}ms</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Priority Alerts */}
        <Card
          title="Alertas Prioritários"
          description="Ocorrências ordenadas por severidade"
          actions={
            <button
              onClick={() => onNavigate?.('alerts')}
              className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Ver Todos
            </button>
          }
        >
          {alerts.filter((a) => a.status !== 'resolvido').length === 0 ? (
            <EmptyState title="Nenhum alerta pendente" description="Sua operação está saudável e sem divergências ativas." />
          ) : (
            <div className="space-y-3">
              {alerts
                .filter((a) => a.status !== 'resolvido')
                .slice(0, 5)
                .map((alert) => {
                  const sev = SEVERITY_COLORS[alert.severidade] ?? SEVERITY_COLORS.informativo;
                  return (
                    <div
                      key={alert.id}
                      onClick={() => onNavigate?.('alerts', alert.id)}
                      className={`cursor-pointer rounded-xl border p-3.5 hover:shadow-md transition-all ${sev.bg}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${sev.dot}`} />
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{alert.titulo}</p>
                            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{alert.mensagem}</p>
                          </div>
                        </div>
                        <Badge label={sev.label} color={sev.color} />
                      </div>
                      {alert.impacto_financeiro > 0 && (
                        <p className="mt-2 text-xs font-semibold text-danger-600 dark:text-danger-400">
                          Impacto estimado: {formatCurrency(Number(alert.impacto_financeiro))}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>

      {/* Operational Timeline */}
      <Card
        title="Timeline Operacional"
        description="Histórico recente de eventos da plataforma"
        actions={
          <button
            onClick={() => onNavigate?.('audit')}
            className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Ver Logs de Auditoria
          </button>
        }
      >
        {auditEntries.length === 0 ? (
          <EmptyState title="Sem registros de auditoria" description="Ações de sincronização e modificações aparecerão aqui." />
        ) : (
          <div className="space-y-3">
            {auditEntries.slice(0, 6).map((entry) => (
              <div
                key={entry.id}
                onClick={() => onNavigate?.('audit')}
                className="flex cursor-pointer items-start gap-3 rounded-lg p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {formatTime(entry.criado_em)}
                </div>
                <div className="flex-1 border-l-2 border-slate-100 pb-2 pl-3 dark:border-slate-800">
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    <span className="font-semibold">{entry.usuario}</span> · {entry.acao}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Módulo {entry.modulo} — {entry.registro} · {formatDate(entry.criado_em)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
