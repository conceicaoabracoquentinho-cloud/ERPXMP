import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { DataTable, Column } from '../components/common/DataTable';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/common/States';
import { Modal } from '../components/common/Modal';
import { apiService } from '../services/apiService';
import { ReconciliationEngine, DiscrepancyAnalysis } from '../services/reconciliationEngine';
import { useToast } from '../contexts/ToastContext';
import { useSync } from '../contexts/SyncContext';
import { GitCompareArrows, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, OctagonAlert as AlertOctagon, RefreshCw, Check, Eye, Search, ListFilter as Filter, DollarSign, Layers, ArrowRight, ShieldAlert, ArrowUpRight, ArrowDownRight, X, Zap, CheckCheck, SlidersHorizontal } from 'lucide-react';
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDate,
} from '../utils/formatters';
import { CONCILIATION_CONFIG } from '../config/constants';
import { useAuditContext } from '../hooks/useAuditContext';
import { Product, Order, AuditEntry, ConciliationStatus } from '../types';

interface ConciliationPageProps {
  initialSelectedId?: string | null;
}

export const ConciliationPage: React.FC<ConciliationPageProps> = ({ initialSelectedId }) => {
  const toast = useToast();
  const { refreshTrigger, notifyDataChanged } = useSync();
  const auditCtx = useAuditContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'diagnostic' | 'audit'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMarketplace, setFilterMarketplace] = useState('todos');
  const [filterType, setFilterType] = useState('todos');
  const [filterSeverity, setFilterSeverity] = useState('todos');
  const [filterCategory, setFilterCategory] = useState('todas');
  const [filterImpact, setFilterImpact] = useState('todos');

  // Modal states
  const [viewingAnalysis, setViewingAnalysis] = useState<DiscrepancyAnalysis | null>(null);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, sku: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, ords, audits] = await Promise.all([
        apiService.getProducts(),
        apiService.getOrders(),
        apiService.getAuditEntries(),
      ]);
      setProducts(prods);
      setOrders(ords);
      setAuditEntries(audits);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados de conciliação');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  useEffect(() => {
    if (initialSelectedId && (products.length > 0 || orders.length > 0)) {
      setSearchTerm(initialSelectedId);
      setFilterMarketplace('todos');
      setFilterType('todos');
      setFilterSeverity('todos');
      setFilterCategory('todas');
      setFilterImpact('todos');

      const isOrderMatch = orders.some(
        (o) =>
          o.id === initialSelectedId ||
          o.numero.toLowerCase() === initialSelectedId.toLowerCase() ||
          (o.codigo_erp && o.codigo_erp.toLowerCase() === initialSelectedId.toLowerCase())
      );
      if (isOrderMatch) {
        setActiveTab('orders');
      } else {
        setActiveTab('products');
      }
    }
  }, [initialSelectedId, products, orders]);

  // Evaluate all products via ReconciliationEngine
  const productAnalyses = useMemo(() => {
    return products.map((p) => ({
      product: p,
      analysis: ReconciliationEngine.evaluateProduct(p),
    }));
  }, [products]);

  // Evaluate all orders
  const orderAnalyses = useMemo(() => {
    return orders.map((o) => ({
      order: o,
      analysis: ReconciliationEngine.evaluateOrder(o),
    }));
  }, [orders]);

  // Unique categories for filter
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set);
  }, [products]);

  // Unique marketplaces
  const marketplaces = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.marketplace) set.add(p.marketplace);
    });
    orders.forEach((o) => {
      if (o.marketplace) set.add(o.marketplace);
    });
    return Array.from(set);
  }, [products, orders]);

  // Filtered Product Analyses
  const filteredProductAnalyses = useMemo(() => {
    return productAnalyses.filter(({ product, analysis }) => {
      // Tab filter: only divergent items unless searching
      if (product.conciliacao === 'conciliado' && !searchTerm) {
        return false;
      }

      // Text Search: SKU, EAN, Código ERP, Título, Marketplace, Categoria, Marca, Fornecedor
      if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const matchesSku = product.sku.toLowerCase().includes(term);
        const matchesEan = (product.ean || '').toLowerCase().includes(term);
        const matchesErp = (product.codigo_erp || '').toLowerCase().includes(term);
        const matchesTitle = product.titulo.toLowerCase().includes(term);
        const matchesMp = (product.marketplace || '').toLowerCase().includes(term);
        const matchesCat = (product.categoria || '').toLowerCase().includes(term);
        const matchesBrand = (product.marca || '').toLowerCase().includes(term);
        const matchesSupplier = (product.fornecedor || '').toLowerCase().includes(term);

        if (
          !matchesSku &&
          !matchesEan &&
          !matchesErp &&
          !matchesTitle &&
          !matchesMp &&
          !matchesCat &&
          !matchesBrand &&
          !matchesSupplier
        ) {
          return false;
        }
      }

      // Filter Marketplace
      if (filterMarketplace !== 'todos' && product.marketplace !== filterMarketplace) {
        return false;
      }

      // Filter Category
      if (filterCategory !== 'todas' && product.categoria !== filterCategory) {
        return false;
      }

      // Filter Severity
      if (filterSeverity !== 'todos' && analysis.severity !== filterSeverity) {
        return false;
      }

      // Filter Divergence Type
      if (filterType !== 'todos' && analysis.type !== filterType) {
        return false;
      }

      // Filter Impact Range
      if (filterImpact !== 'todos') {
        const imp = analysis.financialImpact;
        if (filterImpact === 'gt100' && imp <= 100) return false;
        if (filterImpact === 'gt500' && imp <= 500) return false;
        if (filterImpact === 'gt1000' && imp <= 1000) return false;
        if (filterImpact === 'gt5000' && imp <= 5000) return false;
      }

      return true;
    });
  }, [
    productAnalyses,
    searchTerm,
    filterMarketplace,
    filterCategory,
    filterSeverity,
    filterType,
    filterImpact,
  ]);

  // Filtered Orders
  const divergentOrders = useMemo(() => {
    return orderAnalyses.filter(({ order }) => order.conciliacao !== 'conciliado');
  }, [orderAnalyses]);

  // Overall Engine Statistics
  const stats = useMemo(() => {
    const totalProds = products.length;
    const conciliadosProds = products.filter((p) => p.conciliacao === 'conciliado').length;
    const levesProds = productAnalyses.filter((i) => i.product.conciliacao === 'divergencia_leve').length;
    const criticosProds = productAnalyses.filter(
      (i) => i.product.conciliacao === 'divergencia_critica' || i.product.conciliacao === 'ausente'
    ).length;

    const totalOrds = orders.length;
    const conciliadosOrds = orders.filter((o) => o.conciliacao === 'conciliado').length;

    const impactoTotalProds = productAnalyses
      .filter((i) => i.product.conciliacao !== 'conciliado')
      .reduce((sum, i) => sum + i.analysis.financialImpact, 0);

    const impactoTotalOrds = orderAnalyses
      .filter((i) => i.order.conciliacao !== 'conciliado')
      .reduce((sum, i) => sum + i.analysis.financialImpact, 0);

    return {
      totalProds,
      conciliadosProds,
      divergentesProds: totalProds - conciliadosProds,
      levesProds,
      criticosProds,
      taxaProds: totalProds > 0 ? (conciliadosProds / totalProds) * 100 : 100,
      totalOrds,
      conciliadosOrds,
      divergentesOrds: totalOrds - conciliadosOrds,
      taxaOrds: totalOrds > 0 ? (conciliadosOrds / totalOrds) * 100 : 100,
      impactoTotal: impactoTotalProds + impactoTotalOrds,
    };
  }, [products, orders, productAnalyses, orderAnalyses]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterMarketplace !== 'todos') count++;
    if (filterType !== 'todos') count++;
    if (filterSeverity !== 'todos') count++;
    if (filterCategory !== 'todas') count++;
    if (filterImpact !== 'todos') count++;
    if (searchTerm.trim() !== '') count++;
    return count;
  }, [filterMarketplace, filterType, filterSeverity, filterCategory, filterImpact, searchTerm]);

  const resetFilters = () => {
    setSearchTerm('');
    setFilterMarketplace('todos');
    setFilterType('todos');
    setFilterSeverity('todos');
    setFilterCategory('todas');
    setFilterImpact('todos');
  };

  // Resolve Single Product Conciliation
  const handleResolveProduct = async (product: Product) => {
    setResolvingId(product.id);
    try {
      await apiService.updateProductConciliation(product.id, 'conciliado');
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'conciliacao_manual_produto',
        modulo: 'Conciliação',
        registro: product.sku,
        antes: `Status: ${product.conciliacao}; Preço MP: R$ ${product.preco_marketplace ?? '—'}; Estoque MP: ${product.estoque_marketplace ?? '—'}`,
        depois: `Status: conciliado; Preço MP: R$ ${product.preco}; Estoque MP: ${product.estoque}`,
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });
      toast.success(`SKU ${product.sku} equalizado e conciliado com sucesso!`);
      if (viewingAnalysis?.entityId === product.id) {
        setViewingAnalysis(null);
      }
      notifyDataChanged();
    } catch {
      toast.error('Erro ao conciliar produto.');
    } finally {
      setResolvingId(null);
    }
  };

  // Equalize direction (ERP -> MP or MP -> ERP)
  const handleEqualizeProduct = async (product: Product, direction: 'erp_to_mp' | 'mp_to_erp') => {
    setResolvingId(product.id);
    try {
      const updated = await apiService.equalizeProduct(product.id, direction);
      const directionLabel = direction === 'erp_to_mp' ? 'Marketplace atualizado com ERP' : 'ERP atualizado com Marketplace';

      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'equalizacao_direcional',
        modulo: 'Conciliação',
        registro: product.sku,
        antes: `Preço ERP: R$ ${product.preco}, MP: R$ ${product.preco_marketplace ?? '—'}`,
        depois: `Equalizado (${directionLabel}) -> Preço: R$ ${updated.preco}, Estoque: ${updated.estoque}`,
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });

      toast.success(`Equalização concluída (${directionLabel}) para o SKU ${product.sku}.`);
      setViewingAnalysis(null);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao realizar equalização.');
    } finally {
      setResolvingId(null);
    }
  };

  // Resolve Single Order
  const handleResolveOrder = async (order: Order) => {
    setResolvingId(order.id);
    try {
      await apiService.updateOrderConciliation(order.id, 'conciliado');
      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'conciliacao_manual_pedido',
        modulo: 'Conciliação',
        registro: order.numero,
        antes: order.conciliacao,
        depois: 'conciliado',
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });
      toast.success(`Pedido ${order.numero} conciliado com sucesso.`);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao conciliar pedido.');
    } finally {
      setResolvingId(null);
    }
  };

  // Batch Equalization Process
  const handleStartBatchProcessing = async () => {
    const divergentList = productAnalyses.filter((i) => i.product.conciliacao !== 'conciliado');
    const divergentOrderList = orderAnalyses.filter((i) => i.order.conciliacao !== 'conciliado');

    const totalToProcess = divergentList.length + divergentOrderList.length;
    if (totalToProcess === 0) {
      toast.info('Não há itens divergentes pendentes para conciliar.');
      setBatchModalOpen(false);
      return;
    }

    setBatchProcessing(true);
    setBatchProgress({ current: 0, total: totalToProcess, sku: 'Iniciando...' });

    let processed = 0;

    // 1. Process Products
    for (const item of divergentList) {
      processed++;
      setBatchProgress({ current: processed, total: totalToProcess, sku: `SKU: ${item.product.sku}` });
      await new Promise((r) => setTimeout(r, 120)); // smooth visual step
      await apiService.updateProductConciliation(item.product.id, 'conciliado');
    }

    // 2. Process Orders
    for (const item of divergentOrderList) {
      processed++;
      setBatchProgress({ current: processed, total: totalToProcess, sku: `Pedido: ${item.order.numero}` });
      await new Promise((r) => setTimeout(r, 120));
      await apiService.updateOrderConciliation(item.order.id, 'conciliado');
    }

    // Insert Audit for batch operation
    await apiService.insertAudit({
      usuario: auditCtx.usuario,
      acao: 'conciliacao_lote_motor',
      modulo: 'Conciliação',
      registro: `${totalToProcess} itens (${divergentList.length} produtos, ${divergentOrderList.length} pedidos)`,
      antes: 'Divergências ativas',
      depois: 'Todos conciliados e equalizados',
      ip: auditCtx.ip,
      navegador: auditCtx.navegador,
    });

    toast.success(`Conciliação em lote executada! ${totalToProcess} divergências foram equalizadas.`);
    setBatchProcessing(false);
    setBatchModalOpen(false);
    notifyDataChanged();
  };

  // Product Table Columns
  const productColumns: Column<Product>[] = [
    {
      key: 'sku',
      header: 'SKU / Código ERP',
      sortable: true,
      render: (p) => (
        <div>
          <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{p.sku}</span>
          <p className="font-mono text-[11px] text-slate-500">ERP: {p.codigo_erp || '—'}</p>
        </div>
      ),
    },
    {
      key: 'titulo',
      header: 'Produto / Categoria',
      sortable: true,
      render: (p) => (
        <div className="max-w-xs">
          <p className="line-clamp-1 font-medium text-slate-800 dark:text-slate-100">{p.titulo}</p>
          <p className="text-[11px] text-slate-500">
            {p.categoria} • <span className="font-semibold text-slate-600 dark:text-slate-400">{p.marca}</span>
          </p>
        </div>
      ),
    },
    {
      key: 'marketplace',
      header: 'Marketplace',
      sortable: true,
      render: (p) => (
        <Badge
          label={p.marketplace || 'Geral'}
          color={
            p.marketplace === 'Mercado Livre'
              ? 'warning'
              : p.marketplace === 'Amazon'
              ? 'info'
              : p.marketplace === 'Shopee'
              ? 'danger'
              : 'brand'
          }
        />
      ),
    },
    {
      key: 'preco',
      header: 'Preço ERP × MP',
      render: (p) => {
        const erp = Number(p.preco);
        const mp = p.preco_marketplace !== null ? Number(p.preco_marketplace) : null;
        const diff = mp !== null ? erp - mp : 0;
        const hasDiff = Math.abs(diff) > 0.01;

        return (
          <div className="text-xs">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">ERP:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatCurrency(erp)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-500">MP:</span>
              <span className={`font-mono ${hasDiff ? 'font-bold text-danger-600 dark:text-danger-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {mp !== null ? formatCurrency(mp) : 'Sem oferta'}
              </span>
            </div>
            {hasDiff && (
              <span className="mt-0.5 inline-block text-[10px] font-bold text-danger-600 dark:text-danger-400">
                Δ {formatCurrency(Math.abs(diff))} ({diff > 0 ? 'ERP > MP' : 'MP > ERP'})
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'estoque',
      header: 'Estoque ERP × MP',
      render: (p) => {
        const erp = p.estoque;
        const mp = p.estoque_marketplace;
        const hasDiff = mp !== null && erp !== mp;

        return (
          <div className="text-xs">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">ERP:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatNumber(erp)} un.</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-slate-500">MP:</span>
              <span className={`font-mono ${hasDiff ? 'font-bold text-danger-600 dark:text-danger-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {mp !== null ? `${formatNumber(mp)} un.` : '—'}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'conciliacao',
      header: 'Diagnóstico & Severidade',
      render: (p) => {
        const analysis = ReconciliationEngine.evaluateProduct(p);
        const cfg = CONCILIATION_CONFIG[p.conciliacao] ?? CONCILIATION_CONFIG.ausente;

        const sevBadge =
          analysis.severity === 'critico'
            ? 'danger'
            : analysis.severity === 'alto'
            ? 'warning'
            : analysis.severity === 'medio'
            ? 'brand'
            : 'neutral';

        return (
          <div className="max-w-xs space-y-1">
            <div className="flex items-center gap-1.5">
              <Badge label={cfg.label} color={cfg.color} />
              <Badge label={analysis.severity.toUpperCase()} color={sevBadge} />
            </div>
            <p className="line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400">{analysis.reason}</p>
          </div>
        );
      },
    },
    {
      key: 'impacto',
      header: 'Impacto R$',
      sortable: true,
      render: (p) => {
        const analysis = ReconciliationEngine.evaluateProduct(p);
        return (
          <span
            className={`font-mono text-xs font-bold ${
              analysis.financialImpact > 0 ? 'text-danger-600 dark:text-danger-400' : 'text-slate-400'
            }`}
          >
            {analysis.financialImpact > 0 ? formatCurrency(analysis.financialImpact) : 'R$ 0,00'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Ações de Conciliação',
      render: (p) => {
        const analysis = ReconciliationEngine.evaluateProduct(p);
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setViewingAnalysis(analysis)}
              title="Comparar Lado a Lado"
              icon={<Eye className="h-3.5 w-3.5" />}
            >
              Comparar
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={() => handleResolveProduct(p)}
              loading={resolvingId === p.id}
              icon={<Check className="h-3.5 w-3.5" />}
              title="Equalizar MP com ERP"
            >
              Conciliar
            </Button>
          </div>
        );
      },
    },
  ];

  // Order Table Columns
  const orderColumns: Column<Order>[] = [
    { key: 'numero', header: 'Pedido', sortable: true, className: 'font-mono text-xs font-bold' },
    { key: 'marketplace', header: 'Marketplace', sortable: true, render: (o) => <Badge label={o.marketplace} color="brand" /> },
    { key: 'cliente', header: 'Cliente', sortable: true },
    { key: 'valor', header: 'Valor Pedido', sortable: true, render: (o) => formatCurrency(Number(o.valor)) },
    { key: 'comissao', header: 'Comissão', render: (o) => formatCurrency(Number(o.comissao)) },
    { key: 'status', header: 'Status Pedido', sortable: true },
    {
      key: 'conciliacao',
      header: 'Status Conciliação',
      sortable: true,
      render: (o) => {
        const cfg = CONCILIATION_CONFIG[o.conciliacao] ?? CONCILIATION_CONFIG.ausente;
        return <Badge label={cfg.label} color={cfg.color} />;
      },
    },
    {
      key: 'actions',
      header: 'Ação',
      render: (o) => (
        <Button
          variant="success"
          size="sm"
          onClick={() => handleResolveOrder(o)}
          loading={resolvingId === o.id}
          icon={<Check className="h-3.5 w-3.5" />}
        >
          Conciliar Pedido
        </Button>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Executando Motor de Conciliação em Tempo Real..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      {/* Top Engine Banner / Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
              <GitCompareArrows className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Motor de Conciliação Enterprise
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Análise Comparativa em Tempo Real: ERP × Marketplaces (Preços, Saldos de Estoque, Pedidos e Margens)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={loadData} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            Atualizar Análise
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={() => setBatchModalOpen(true)}
            icon={<Zap className="h-3.5 w-3.5" />}
            disabled={stats.divergentesProds + stats.divergentesOrds === 0}
          >
            Conciliar Todos em Lote ({stats.divergentesProds + stats.divergentesOrds})
          </Button>
        </div>
      </div>

      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-950/50">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Conciliação Catálogo</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {formatPercent(stats.taxaProds)}
              </p>
              <p className="text-[10px] text-slate-400">
                {stats.conciliadosProds} de {stats.totalProds} produtos
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50">
              <CheckCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Conciliação Pedidos</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {formatPercent(stats.taxaOrds)}
              </p>
              <p className="text-[10px] text-slate-400">
                {stats.conciliadosOrds} de {stats.totalOrds} pedidos
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-950/50">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Divergências Leves</p>
              <p className="text-lg font-bold text-warning-600 dark:text-warning-400">
                {formatNumber(stats.levesProds)}
              </p>
              <p className="text-[10px] text-slate-400">Ajustes de preço/estoque</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-50 text-danger-600 dark:bg-danger-950/50">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Divergências Críticas</p>
              <p className="text-lg font-bold text-danger-600 dark:text-danger-400">
                {formatNumber(stats.criticosProds)}
              </p>
              <p className="text-[10px] text-slate-400">Furos de estoque e ausentes</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-50 text-danger-600 dark:bg-danger-950/50">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Impacto em Risco</p>
              <p className="text-lg font-bold text-danger-600 dark:text-danger-400">
                {formatCurrency(stats.impactoTotal)}
              </p>
              <p className="text-[10px] text-slate-400">Valor financeiro afetado</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Multi-Filter & Search Toolbar */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Filtros e Pesquisa do Motor de Reconciliação
              </h3>
              {activeFiltersCount > 0 && (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                  {activeFiltersCount} ativo(s)
                </span>
              )}
            </div>

            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters} icon={<X className="h-3.5 w-3.5" />}>
                Limpar Filtros
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {/* Search Input */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por SKU, EAN, Código ERP, Título, Marca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Marketplace Selector */}
            <div>
              <select
                value={filterMarketplace}
                onChange={(e) => setFilterMarketplace(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="todos">Todos Marketplaces</option>
                {marketplaces.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Divergence Type */}
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="todos">Todos Tipos Divergência</option>
                <option value="price">Divergência de Preço</option>
                <option value="stock">Divergência de Estoque</option>
                <option value="zero_stock_mp">Estoque Zerado no MP</option>
                <option value="zero_stock_erp">Estoque Zerado no ERP</option>
                <option value="missing_mp">Oferta Ausente no MP</option>
                <option value="missing_ean">EAN Inconsistente</option>
              </select>
            </div>

            {/* Severity */}
            <div>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="todos">Todas Severidades</option>
                <option value="critico">Crítico</option>
                <option value="alto">Alto</option>
                <option value="medio">Médio</option>
                <option value="baixo">Baixo</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-800 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="todas">Todas Categorias</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Switcher Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
            activeTab === 'products'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          Produtos com Divergência
          <span className="rounded-full bg-danger-100 px-2 py-0.5 text-[10px] font-bold text-danger-700 dark:bg-danger-950 dark:text-danger-300">
            {filteredProductAnalyses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
            activeTab === 'orders'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Pedidos com Divergência
          <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[10px] font-bold text-warning-700 dark:bg-warning-950 dark:text-warning-300">
            {divergentOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostic')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
            activeTab === 'diagnostic'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <GitCompareArrows className="h-4 w-4" />
          Diagnóstico por Marketplace
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition-colors ${
            activeTab === 'audit'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          Auditoria & Histórico
        </button>
      </div>

      {/* Tab 1: Products Table */}
      {activeTab === 'products' && (
        <Card
          title="Tabela de Reconciliação do Catálogo de Produtos"
          description="Comparativo detalhado entre o cadastro oficial do ERP e os anúncios ativos nos Marketplaces"
          action={
            filteredProductAnalyses.length > 0 ? (
              <Button
                variant="success"
                size="sm"
                onClick={() => setBatchModalOpen(true)}
                icon={<Check className="h-3.5 w-3.5" />}
              >
                Equalizar Filtrados em Lote ({filteredProductAnalyses.length})
              </Button>
            ) : undefined
          }
        >
          {filteredProductAnalyses.length === 0 ? (
            <EmptyState
              title="Nenhuma divergência encontrada com os filtros atuais!"
              description="Todos os produtos do catálogo estão 100% conciliados com os canais de vendas."
            />
          ) : (
            <DataTable
              columns={productColumns}
              data={filteredProductAnalyses.map((i) => i.product)}
              getRowId={(p) => p.id}
              pageSize={10}
            />
          )}
        </Card>
      )}

      {/* Tab 2: Orders Table */}
      {activeTab === 'orders' && (
        <Card
          title="Pedidos com Divergência ou Repasse Pendente"
          description="Pedidos com divergências de comissão, frete ou aguardando confirmação do gateway"
        >
          {divergentOrders.length === 0 ? (
            <EmptyState
              title="Todos os pedidos estão 100% conciliados!"
              description="Comissões, fretes e repasses batem exatamente com as faturas dos marketplaces."
            />
          ) : (
            <DataTable
              columns={orderColumns}
              data={divergentOrders.map((i) => i.order)}
              getRowId={(o) => o.id}
              pageSize={10}
            />
          )}
        </Card>
      )}

      {/* Tab 3: Marketplace Diagnostics Breakdown */}
      {activeTab === 'diagnostic' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {marketplaces.map((mpName) => {
              const mpProducts = products.filter((p) => p.marketplace === mpName);
              const totalMp = mpProducts.length;
              const conciliadosMp = mpProducts.filter((p) => p.conciliacao === 'conciliado').length;
              const divergentesMp = totalMp - conciliadosMp;
              const taxa = totalMp > 0 ? (conciliadosMp / totalMp) * 100 : 100;

              const mpImpact = productAnalyses
                .filter((i) => i.product.marketplace === mpName && i.product.conciliacao !== 'conciliado')
                .reduce((sum, i) => sum + i.analysis.financialImpact, 0);

              return (
                <Card key={mpName}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{mpName}</span>
                      <Badge
                        label={taxa === 100 ? '100% OK' : `${divergentesMp} divergente(s)`}
                        color={taxa === 100 ? 'success' : 'danger'}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Taxa de Conciliação</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{formatPercent(taxa)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full transition-all ${
                            taxa === 100 ? 'bg-success-500' : taxa > 70 ? 'bg-warning-500' : 'bg-danger-500'
                          }`}
                          style={{ width: `${taxa}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                      <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
                        <p className="text-[10px] text-slate-400">Total Anúncios</p>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{totalMp}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/50">
                        <p className="text-[10px] text-slate-400">Impacto R$</p>
                        <p className="font-bold text-danger-600 dark:text-danger-400">{formatCurrency(mpImpact)}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Audit Logs */}
      {activeTab === 'audit' && (
        <Card
          title="Histórico de Auditoria de Conciliações"
          description="Registros imutáveis de alterações e equalizações executadas pelo motor"
        >
          {auditEntries.length === 0 ? (
            <EmptyState title="Nenhum registro de auditoria disponível." description="As conciliações efetuadas gerarão históricos automaticamente." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                    <th className="p-3">Data/Hora</th>
                    <th className="p-3">Ação</th>
                    <th className="p-3">Registro (SKU/Pedido)</th>
                    <th className="p-3">Estado Anterior</th>
                    <th className="p-3">Estado Após Equalização</th>
                    <th className="p-3">Usuário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {auditEntries
                    .filter((a) => a.modulo === 'Conciliação' || a.acao.includes('concilia') || a.acao.includes('equaliza'))
                    .map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-mono text-slate-500">{formatDate(entry.criado_em)}</td>
                        <td className="p-3 font-semibold text-brand-600 dark:text-brand-400">{entry.acao}</td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{entry.registro}</td>
                        <td className="p-3 text-slate-500">{entry.antes || '—'}</td>
                        <td className="p-3 text-success-600 dark:text-success-400 font-semibold">{entry.depois || '—'}</td>
                        <td className="p-3 text-slate-500">{entry.usuario}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Side-by-Side Comparison Matrix Modal (`viewingAnalysis`) */}
      {viewingAnalysis && (
        <Modal
          open={Boolean(viewingAnalysis)}
          onClose={() => setViewingAnalysis(null)}
          title={
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-5 w-5 text-brand-600" />
              <span>Análise Comparativa Lado a Lado — SKU: {viewingAnalysis.sku}</span>
            </div>
          }
          size="xl"
          footer={
            <div className="flex items-center gap-2 flex-wrap w-full justify-between">
              <Button variant="secondary" onClick={() => setViewingAnalysis(null)}>
                Fechar
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    const p = products.find((prod) => prod.id === viewingAnalysis.entityId);
                    if (p) handleEqualizeProduct(p, 'mp_to_erp');
                  }}
                  disabled={resolvingId === viewingAnalysis.entityId}
                  title="Atualiza o cadastro do ERP com as informações vindas do Marketplace"
                >
                  Equalizar ERP com MP
                </Button>

                <Button
                  variant="success"
                  onClick={() => {
                    const p = products.find((prod) => prod.id === viewingAnalysis.entityId);
                    if (p) handleEqualizeProduct(p, 'erp_to_mp');
                  }}
                  loading={resolvingId === viewingAnalysis.entityId}
                  icon={<Check className="h-4 w-4" />}
                  title="Força o Marketplace a adotar preço e estoque oficial do ERP"
                >
                  Equalizar MP com ERP (Recomendado)
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            {/* Header Product Summary */}
            <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50 sm:grid-cols-3">
              <div>
                <p className="text-[10px] text-slate-400">Produto</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{viewingAnalysis.details.titulo}</p>
                <p className="text-xs text-slate-500">{viewingAnalysis.details.categoria} • {viewingAnalysis.details.marca}</p>
              </div>

              <div>
                <p className="text-[10px] text-slate-400">Marketplace / Canal</p>
                <Badge label={viewingAnalysis.marketplace} color="brand" />
                <p className="mt-1 text-xs text-slate-500">Fornecedor: {viewingAnalysis.details.fornecedor}</p>
              </div>

              <div>
                <p className="text-[10px] text-slate-400">Impacto Estimado da Divergência</p>
                <p className="text-lg font-bold text-danger-600 dark:text-danger-400">
                  {formatCurrency(viewingAnalysis.financialImpact)}
                </p>
              </div>
            </div>

            {/* Comparison Matrix Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
                    <th className="p-3 font-semibold">Atributo</th>
                    <th className="p-3 font-semibold text-brand-700 dark:text-brand-300">ERP (Sistema Oficial)</th>
                    <th className="p-3 font-semibold text-brand-700 dark:text-brand-300">
                      Marketplace ({viewingAnalysis.marketplace})
                    </th>
                    <th className="p-3 font-semibold">Diagnóstico da Comparação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {/* SKU */}
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-medium text-slate-600 dark:text-slate-400">SKU Oferta</td>
                    <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{viewingAnalysis.sku}</td>
                    <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{viewingAnalysis.sku}</td>
                    <td className="p-3 text-success-600 dark:text-success-400 font-medium">✓ SKU Idêntico</td>
                  </tr>

                  {/* EAN / GTIN */}
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-medium text-slate-600 dark:text-slate-400">EAN / Código Barras</td>
                    <td className="p-3 font-mono text-slate-800 dark:text-slate-200">
                      {viewingAnalysis.details.ean || <span className="text-danger-500">Ausente</span>}
                    </td>
                    <td className="p-3 font-mono text-slate-800 dark:text-slate-200">
                      {viewingAnalysis.details.ean || <span className="text-danger-500">Ausente</span>}
                    </td>
                    <td className="p-3">
                      {viewingAnalysis.details.ean ? (
                        <span className="text-success-600 dark:text-success-400 font-medium">✓ EAN Válido</span>
                      ) : (
                        <span className="text-warning-600 dark:text-warning-400 font-bold">⚠ Cadastro Sem EAN</span>
                      )}
                    </td>
                  </tr>

                  {/* ERP Code */}
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-medium text-slate-600 dark:text-slate-400">Código ERP</td>
                    <td className="p-3 font-mono text-slate-800 dark:text-slate-200">{viewingAnalysis.details.codigoErp}</td>
                    <td className="p-3 font-mono text-slate-800 dark:text-slate-200">{viewingAnalysis.details.codigoErp}</td>
                    <td className="p-3 text-success-600 dark:text-success-400 font-medium">✓ Vinculado</td>
                  </tr>

                  {/* Price */}
                  <tr className="bg-slate-50/80 hover:bg-slate-100/50 dark:bg-slate-800/30">
                    <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">Preço de Venda</td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(viewingAnalysis.details.erpPrice)}
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {viewingAnalysis.details.mpPrice !== null
                        ? formatCurrency(viewingAnalysis.details.mpPrice)
                        : 'Sem Oferta'}
                    </td>
                    <td className="p-3 font-semibold">
                      {viewingAnalysis.details.priceDiff > 0.01 ? (
                        <span className="text-danger-600 dark:text-danger-400">
                          ✖ Divergente (Diferença: {formatCurrency(viewingAnalysis.details.priceDiff)})
                        </span>
                      ) : (
                        <span className="text-success-600 dark:text-success-400">✓ Preços Iguais</span>
                      )}
                    </td>
                  </tr>

                  {/* Stock */}
                  <tr className="bg-slate-50/80 hover:bg-slate-100/50 dark:bg-slate-800/30">
                    <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">Saldo em Estoque</td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatNumber(viewingAnalysis.details.erpStock)} un.
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                      {viewingAnalysis.details.mpStock !== null
                        ? `${formatNumber(viewingAnalysis.details.mpStock)} un.`
                        : '—'}
                    </td>
                    <td className="p-3 font-semibold">
                      {viewingAnalysis.details.stockDiff > 0 ? (
                        <span className="text-danger-600 dark:text-danger-400">
                          ✖ Divergente (Diferença: {viewingAnalysis.details.stockDiff} un.)
                        </span>
                      ) : (
                        <span className="text-success-600 dark:text-success-400">✓ Saldo Sincronizado</span>
                      )}
                    </td>
                  </tr>

                  {/* Status */}
                  <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3 font-medium text-slate-600 dark:text-slate-400">Status da Oferta</td>
                    <td className="p-3">
                      <Badge label={viewingAnalysis.details.ativoErp ? 'Ativo no ERP' : 'Inativo'} color="success" />
                    </td>
                    <td className="p-3">
                      <Badge
                        label={viewingAnalysis.details.ativoMp ? 'Ativo no MP' : 'Inativo / Ausente'}
                        color={viewingAnalysis.details.ativoMp ? 'success' : 'danger'}
                      />
                    </td>
                    <td className="p-3 text-slate-500 font-medium">
                      {viewingAnalysis.details.ativoErp === viewingAnalysis.details.ativoMp ? '✓ Alinhado' : '⚠ Status Divergente'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Diagnostic Reason & Recommendation */}
            <div className="rounded-xl border border-warning-200 bg-warning-50/60 p-4 dark:border-warning-900/50 dark:bg-warning-950/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-600 dark:text-warning-400" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-warning-800 dark:text-warning-300">
                    {viewingAnalysis.title}
                  </p>
                  <p className="text-xs text-warning-700 dark:text-warning-400">{viewingAnalysis.reason}</p>
                  <p className="text-xs font-semibold text-warning-900 dark:text-warning-200 mt-2">
                    💡 Ação Recomendada pelo Motor: {viewingAnalysis.recommendation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Batch Processing Confirmation & Progress Modal */}
      {batchModalOpen && (
        <Modal
          open={batchModalOpen}
          onClose={() => !batchProcessing && setBatchModalOpen(false)}
          title="Conciliação e Equalização em Lote"
          size="md"
          footer={
            batchProcessing ? null : (
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setBatchModalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="success" onClick={handleStartBatchProcessing} icon={<Zap className="h-4 w-4" />}>
                  Iniciar Equalização
                </Button>
              </div>
            )
          }
        >
          {batchProcessing ? (
            <div className="space-y-5 py-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Equalizando registros em tempo real...
                </h4>
                <p className="mt-1 text-xs text-slate-500">{batchProgress.sku}</p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span>Progresso da Operação</span>
                  <span>
                    {batchProgress.current} de {batchProgress.total} (
                    {Math.round((batchProgress.current / batchProgress.total) * 100)}%)
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-brand-600 transition-all duration-300 dark:bg-brand-400"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                O motor executará a equalização automática para{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {stats.divergentesProds} produtos
                </strong>{' '}
                e{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {stats.divergentesOrds} pedidos
                </strong>{' '}
                com divergências ativas.
              </p>

              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/50">
                <p className="font-semibold text-slate-700 dark:text-slate-300">O que será feito durante o lote:</p>
                <ul className="mt-1.5 list-inside list-disc space-y-1">
                  <li>Atualização dos preços e estoques dos marketplaces conforme cadastro do ERP</li>
                  <li>Sincronização dos status de conciliação para "Conciliado"</li>
                  <li>Baixa e resolução automática dos Alertas operacionais vinculados</li>
                  <li>Inclusão de registro imutável de Auditoria</li>
                  <li>Atualização em tempo real do Dashboard, Financeiro e Alertas</li>
                </ul>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
