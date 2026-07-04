import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { DataTable, Column } from '../components/common/DataTable';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/common/States';
import { apiService } from '../services/apiService';
import { useToast } from '../contexts/ToastContext';
import { useSync } from '../contexts/SyncContext';
import { Eye, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, OctagonAlert as AlertOctagon, Pencil, Save, RefreshCw, Search, ListFilter as Filter, X, Package, Boxes, DollarSign, Power, Activity, History, Tag } from 'lucide-react';
import {
  formatCurrency,
  formatNumber,
  formatDate,
} from '../utils/formatters';
import { matchSearchTerm } from '../utils/normalizers';
import { CONCILIATION_CONFIG } from '../config/constants';
import { Product, AuditEntry } from '../types';

interface ProductsPageProps {
  initialSelectedId?: string | null;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({ initialSelectedId }) => {
  const toast = useToast();
  const { refreshTrigger, notifyDataChanged } = useSync();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  // Search & Combined Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [brandFilter, setBrandFilter] = useState('todos');
  const [supplierFilter, setSupplierFilter] = useState('todos');
  const [marketplaceFilter, setMarketplaceFilter] = useState('todos');
  const [conciliationFilter, setConciliationFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [stockFilter, setStockFilter] = useState('todos');
  const [priceRangeFilter, setPriceRangeFilter] = useState('todos');

  // Modals state
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, audits] = await Promise.all([
        apiService.getProducts(),
        apiService.getAuditEntries(),
      ]);
      setProducts(prods);
      setAuditEntries(audits);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  useEffect(() => {
    if (initialSelectedId && products.length > 0) {
      const found = products.find(
        (p) =>
          p.id === initialSelectedId ||
          p.sku.toLowerCase() === initialSelectedId.toLowerCase() ||
          p.codigo_erp.toLowerCase() === initialSelectedId.toLowerCase()
      );
      if (found) {
        setSearchTerm('');
        setCategoryFilter('todos');
        setBrandFilter('todos');
        setSupplierFilter('todos');
        setMarketplaceFilter('todos');
        setConciliationFilter('todos');
        setStatusFilter('todos');
        setStockFilter('todos');
        setPriceRangeFilter('todos');
        setViewProduct(found);
      }
    }
  }, [initialSelectedId, products]);

  // Unique options for filter selects
  const filterOptions = useMemo(() => {
    const categories = Array.from(new Set(products.map((p) => p.categoria).filter(Boolean))).sort();
    const brands = Array.from(new Set(products.map((p) => p.marca).filter(Boolean))).sort();
    const suppliers = Array.from(new Set(products.map((p) => p.fornecedor).filter(Boolean))).sort();
    const marketplaces = Array.from(new Set(products.map((p) => p.marketplace).filter((m): m is string => !!m))).sort();

    return { categories, brands, suppliers, marketplaces };
  }, [products]);

  // Executive KPI summary metrics
  const stats = useMemo(() => {
    const total = products.length;
    const ativos = products.filter((p) => p.ativo).length;
    const conciliados = products.filter((p) => p.conciliacao === 'conciliado').length;
    const divergentes = products.filter((p) => p.conciliacao !== 'conciliado').length;
    const valorEstoque = products.reduce((acc, p) => acc + Number(p.preco) * p.estoque, 0);

    return { total, ativos, conciliados, divergentes, valorEstoque };
  }, [products]);

  // Filtered Products Dataset
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Matching across multiple fields
      if (searchTerm.trim()) {
        const query = searchTerm.trim();
        const matchesSku = matchSearchTerm(p.sku, query);
        const matchesEan = matchSearchTerm(p.ean, query);
        const matchesErp = matchSearchTerm(p.codigo_erp, query);
        const matchesTitle = matchSearchTerm(p.titulo, query);
        const matchesBrand = matchSearchTerm(p.marca, query);
        const matchesSupplier = matchSearchTerm(p.fornecedor, query);
        const matchesCategory = matchSearchTerm(p.categoria, query);
        const matchesMarketplace = matchSearchTerm(p.marketplace, query);
        const matchesDesc = matchSearchTerm(p.descricao, query);

        if (
          !matchesSku &&
          !matchesEan &&
          !matchesErp &&
          !matchesTitle &&
          !matchesBrand &&
          !matchesSupplier &&
          !matchesCategory &&
          !matchesMarketplace &&
          !matchesDesc
        ) {
          return false;
        }
      }

      // 2. Category Filter
      if (categoryFilter !== 'todos' && p.categoria !== categoryFilter) {
        return false;
      }

      // 3. Brand Filter
      if (brandFilter !== 'todos' && p.marca !== brandFilter) {
        return false;
      }

      // 4. Supplier Filter
      if (supplierFilter !== 'todos' && p.fornecedor !== supplierFilter) {
        return false;
      }

      // 5. Marketplace Filter
      if (marketplaceFilter !== 'todos' && p.marketplace !== marketplaceFilter) {
        return false;
      }

      // 6. Conciliation Filter
      if (conciliationFilter !== 'todos' && p.conciliacao !== conciliationFilter) {
        return false;
      }

      // 7. Active Status Filter
      if (statusFilter === 'ativos' && !p.ativo) return false;
      if (statusFilter === 'inativos' && p.ativo) return false;

      // 8. Stock Filter
      if (stockFilter === 'com_estoque' && p.estoque <= 0) return false;
      if (stockFilter === 'sem_estoque' && p.estoque > 0) return false;
      if (stockFilter === 'estoque_baixo' && (p.estoque <= 0 || p.estoque > 5)) return false;

      // 9. Price Range Filter
      const price = Number(p.preco);
      if (priceRangeFilter === 'ate_100' && price > 100) return false;
      if (priceRangeFilter === '100_500' && (price < 100 || price > 500)) return false;
      if (priceRangeFilter === '500_2000' && (price < 500 || price > 2000)) return false;
      if (priceRangeFilter === 'acima_2000' && price <= 2000) return false;

      return true;
    });
  }, [
    products,
    searchTerm,
    categoryFilter,
    brandFilter,
    supplierFilter,
    marketplaceFilter,
    conciliationFilter,
    statusFilter,
    stockFilter,
    priceRangeFilter,
  ]);

  const hasActiveFilters =
    searchTerm !== '' ||
    categoryFilter !== 'todos' ||
    brandFilter !== 'todos' ||
    supplierFilter !== 'todos' ||
    marketplaceFilter !== 'todos' ||
    conciliationFilter !== 'todos' ||
    statusFilter !== 'todos' ||
    stockFilter !== 'todos' ||
    priceRangeFilter !== 'todos';

  const clearAllFilters = () => {
    setSearchTerm('');
    setCategoryFilter('todos');
    setBrandFilter('todos');
    setSupplierFilter('todos');
    setMarketplaceFilter('todos');
    setConciliationFilter('todos');
    setStatusFilter('todos');
    setStockFilter('todos');
    setPriceRangeFilter('todos');
  };

  const handleEqualizeProduct = async (product: Product) => {
    setResolvingId(product.id);
    try {
      await apiService.updateProduct(product.id, {
        preco_marketplace: product.preco,
        estoque_marketplace: product.estoque,
        conciliacao: 'conciliado',
      });
      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'equalizacao_produto',
        modulo: 'Produtos',
        registro: product.sku,
        antes: `Divergência: MP R$ ${product.preco_marketplace ?? '—'} / ${product.estoque_marketplace ?? '—'} un`,
        depois: `Conciliado: R$ ${product.preco} / ${product.estoque} un`,
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });
      toast.success(`Anúncio ${product.sku} equalizado com sucesso no Marketplace!`);
      await loadData();
      notifyDataChanged();
      if (viewProduct?.id === product.id) {
        setViewProduct((prev) =>
          prev
            ? {
                ...prev,
                preco_marketplace: product.preco,
                estoque_marketplace: product.estoque,
                conciliacao: 'conciliado',
              }
            : null
        );
      }
    } catch {
      toast.error('Erro ao equalizar anúncio.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleToggleActiveProduct = async (product: Product) => {
    if (togglingId === product.id) return;
    setTogglingId(product.id);
    try {
      await apiService.updateProduct(product.id, { ativo: !product.ativo });
      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: product.ativo ? 'desativar_produto' : 'ativar_produto',
        modulo: 'Produtos',
        registro: product.sku,
        antes: product.ativo ? 'Ativo' : 'Inativo',
        depois: product.ativo ? 'Inativo' : 'Ativo',
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });
      toast.success(product.ativo ? `Produto ${product.sku} desativado.` : `Produto ${product.sku} ativado.`);
      await loadData();
      notifyDataChanged();
    } catch {
      toast.error('Erro ao alterar status do produto.');
    } finally {
      setTogglingId(null);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct({ ...product });
    setFormError(null);
  };

  const validateEditForm = () => {
    if (!editingProduct) return false;
    if (!editingProduct.titulo.trim()) {
      setFormError('Título do produto é obrigatório.');
      return false;
    }
    if (!editingProduct.sku.trim()) {
      setFormError('SKU é obrigatório.');
      return false;
    }
    if (isNaN(Number(editingProduct.preco)) || Number(editingProduct.preco) < 0) {
      setFormError('Preço ERP deve ser um número válido maior ou igual a zero.');
      return false;
    }
    if (isNaN(Number(editingProduct.estoque)) || Number(editingProduct.estoque) < 0) {
      setFormError('Estoque ERP deve ser um número inteiro válido.');
      return false;
    }
    if (editingProduct.preco_marketplace !== null && editingProduct.preco_marketplace !== undefined) {
      if (isNaN(Number(editingProduct.preco_marketplace)) || Number(editingProduct.preco_marketplace) < 0) {
        setFormError('Preço Marketplace deve ser um número válido maior ou igual a zero.');
        return false;
      }
    }
    if (editingProduct.estoque_marketplace !== null && editingProduct.estoque_marketplace !== undefined) {
      if (isNaN(Number(editingProduct.estoque_marketplace)) || Number(editingProduct.estoque_marketplace) < 0) {
        setFormError('Estoque Marketplace deve ser um número inteiro válido.');
        return false;
      }
    }
    if (editingProduct.custo !== null && editingProduct.custo !== undefined) {
      if (isNaN(Number(editingProduct.custo)) || Number(editingProduct.custo) < 0) {
        setFormError('Custo do produto deve ser um número válido maior ou igual a zero.');
        return false;
      }
    }
    setFormError(null);
    return true;
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;
    if (!validateEditForm()) return;

    setSavingEdit(true);
    try {
      const precoNumber = Number(editingProduct.preco);
      const estoqueNumber = Number(editingProduct.estoque);
      const precoMPNumber =
        editingProduct.preco_marketplace !== null && editingProduct.preco_marketplace !== undefined
          ? Number(editingProduct.preco_marketplace)
          : precoNumber;
      const estoqueMPNumber =
        editingProduct.estoque_marketplace !== null && editingProduct.estoque_marketplace !== undefined
          ? Number(editingProduct.estoque_marketplace)
          : estoqueNumber;

      await apiService.updateProduct(editingProduct.id, {
        titulo: editingProduct.titulo,
        sku: editingProduct.sku,
        ean: editingProduct.ean,
        codigo_erp: editingProduct.codigo_erp,
        categoria: editingProduct.categoria,
        marca: editingProduct.marca,
        fornecedor: editingProduct.fornecedor,
        marketplace: editingProduct.marketplace,
        preco: precoNumber,
        preco_marketplace: precoMPNumber,
        estoque: estoqueNumber,
        estoque_marketplace: estoqueMPNumber,
        custo: Number(editingProduct.custo || 0),
        preco_promocional: editingProduct.preco_promocional ? Number(editingProduct.preco_promocional) : null,
        ativo: editingProduct.ativo,
      });

      await apiService.insertAudit({
        usuario: 'Administrador',
        acao: 'edicao_produto',
        modulo: 'Produtos',
        registro: editingProduct.sku,
        antes: 'Dados Anteriores',
        depois: `Preço ERP: R$ ${precoNumber} | Preço MP: R$ ${precoMPNumber} | Estoque ERP: ${estoqueNumber} | Estoque MP: ${estoqueMPNumber}`,
        ip: '189.120.44.12',
        navegador: navigator.userAgent,
      });

      toast.success(`Produto ${editingProduct.sku} atualizado com sucesso!`);
      setEditingProduct(null);
      await loadData();
      notifyDataChanged();
    } catch {
      toast.error('Erro ao salvar alterações do produto.');
    } finally {
      setSavingEdit(false);
    }
  };

  const columns: Column<Product>[] = [
    { key: 'sku', header: 'SKU', sortable: true, className: 'font-mono text-xs font-bold text-slate-800 dark:text-slate-100' },
    {
      key: 'codigo_erp',
      header: 'ERP / EAN',
      sortable: true,
      render: (p) => (
        <div className="font-mono text-xs text-slate-600 dark:text-slate-300">
          <p>{p.codigo_erp || '—'}</p>
          <p className="text-[10px] text-slate-400">{p.ean || '—'}</p>
        </div>
      ),
    },
    {
      key: 'titulo',
      header: 'Produto',
      sortable: true,
      render: (p) => (
        <div className="max-w-xs">
          <p className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">{p.titulo}</p>
          <p className="text-[10px] text-slate-400 truncate">{p.marca} · {p.fornecedor}</p>
        </div>
      ),
    },
    { key: 'categoria', header: 'Categoria', sortable: true, className: 'text-xs text-slate-600 dark:text-slate-300' },
    {
      key: 'preco',
      header: 'Preço (ERP × MP)',
      sortable: true,
      render: (p) => {
        const precoERP = Number(p.preco);
        const precoMP = p.preco_marketplace !== null ? Number(p.preco_marketplace) : null;
        const diff = precoMP !== null && Math.abs(precoERP - precoMP) > 0.01;

        return (
          <div className="text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(precoERP)}</span>
            {precoMP !== null && (
              <span className={`block text-[10px] ${diff ? 'font-bold text-warning-600 dark:text-warning-400' : 'text-slate-400'}`}>
                MP: {formatCurrency(precoMP)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'estoque',
      header: 'Estoque (ERP × MP)',
      sortable: true,
      render: (p) => {
        const estERP = p.estoque;
        const estMP = p.estoque_marketplace;
        const diff = estMP !== null && estMP !== estERP;

        return (
          <div className="text-xs">
            <span className={`font-bold ${estERP === 0 ? 'text-danger-600' : 'text-slate-800 dark:text-slate-100'}`}>
              {formatNumber(estERP)} un
            </span>
            {estMP !== null && (
              <span className={`block text-[10px] ${diff ? 'font-bold text-danger-600 dark:text-danger-400' : 'text-slate-400'}`}>
                MP: {formatNumber(estMP)} un
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'conciliacao',
      header: 'Conciliação',
      sortable: true,
      render: (p) => {
        const cfg = CONCILIATION_CONFIG[p.conciliacao] ?? CONCILIATION_CONFIG.ausente;
        const Icon = p.conciliacao === 'conciliado' ? CheckCircle2 : p.conciliacao === 'divergencia_critica' ? AlertOctagon : AlertTriangle;
        return (
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cfg.color}`}>
            <Icon className="h-4 w-4 shrink-0" /> {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'ativo',
      header: 'Status',
      sortable: true,
      render: (p) => (
        <Badge
          label={p.ativo ? 'Ativo' : 'Inativo'}
          color={
            p.ativo
              ? 'text-success-700 bg-success-50 dark:text-success-300 dark:bg-success-950/40'
              : 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'
          }
        />
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (p) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setViewProduct(p)} title="Ver detalhes completos" className="p-1.5">
            <Eye className="h-4 w-4 text-slate-500" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEditModal(p)} title="Editar produto" className="p-1.5">
            <Pencil className="h-4 w-4 text-slate-500" />
          </Button>
          {p.conciliacao !== 'conciliado' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEqualizeProduct(p)}
              loading={resolvingId === p.id}
              title="Equalizar anúncio com o ERP"
              className="p-1.5 text-brand-600 hover:bg-brand-50"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleActiveProduct(p)}
            title={p.ativo ? 'Desativar no catálogo' : 'Ativar no catálogo'}
            className={`p-1.5 ${p.ativo ? 'text-slate-400 hover:text-danger-600' : 'text-success-600'}`}
          >
            <Power className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Carregando catálogo de produtos e conciliação..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      {/* Top Summary Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total de Produtos</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatNumber(stats.total)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-950 dark:text-success-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Produtos Ativos</p>
              <p className="text-xl font-bold text-success-600 dark:text-success-400">{formatNumber(stats.ativos)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-950 dark:text-warning-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Com Divergência</p>
              <p className="text-xl font-bold text-warning-600 dark:text-warning-400">{formatNumber(stats.divergentes)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Valor em Estoque (ERP)</p>
              <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{formatCurrency(stats.valorEstoque)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Advanced Filter Bar */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="input-base pl-9 pr-8 text-xs"
                placeholder="Pesquisar por SKU (ex: TCB-000021 ou TCB000021), EAN, ERP, Título, Marca, Fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} icon={<X className="h-3.5 w-3.5" />}>
                Limpar Filtros
              </Button>
            )}
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <select
              className="input-base text-[11px] py-1.5"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="todos">Categoria: Todas</option>
              {filterOptions.categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
            >
              <option value="todos">Marca: Todas</option>
              {filterOptions.brands.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              <option value="todos">Fornecedor: Todos</option>
              {filterOptions.suppliers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={marketplaceFilter}
              onChange={(e) => setMarketplaceFilter(e.target.value)}
            >
              <option value="todos">Canal: Todos</option>
              {filterOptions.marketplaces.map((mp) => (
                <option key={mp} value={mp}>{mp}</option>
              ))}
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={conciliationFilter}
              onChange={(e) => setConciliationFilter(e.target.value)}
            >
              <option value="todos">Conciliação: Todas</option>
              <option value="conciliado">Conciliado</option>
              <option value="divergencia_leve">Divergência leve</option>
              <option value="divergencia_critica">Divergência crítica</option>
              <option value="ausente">Ausente</option>
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="todos">Status: Todos</option>
              <option value="ativos">Somente Ativos</option>
              <option value="inativos">Somente Inativos</option>
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="todos">Estoque: Todos</option>
              <option value="com_estoque">Com Estoque</option>
              <option value="sem_estoque">Sem Estoque (0)</option>
              <option value="estoque_baixo">Estoque Baixo (&le;5)</option>
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={priceRangeFilter}
              onChange={(e) => setPriceRangeFilter(e.target.value)}
            >
              <option value="todos">Preço: Todos</option>
              <option value="ate_100">Até R$ 100</option>
              <option value="100_500">R$ 100 – R$ 500</option>
              <option value="500_2000">R$ 500 – R$ 2.000</option>
              <option value="acima_2000">Acima de R$ 2.000</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main Catalog Table */}
      <Card title="Catálogo Mestre de Produtos" description={`Exibindo ${filteredProducts.length} de ${products.length} produtos cadastrados`}>
        {filteredProducts.length === 0 ? (
          <EmptyState
            title="Nenhum produto encontrado"
            description="Não foram encontrados produtos com os critérios de pesquisa selecionados. Clique em 'Limpar Filtros' para ver todo o catálogo."
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredProducts}
            getRowId={(p) => p.id}
            pageSize={10}
            searchable={false}
          />
        )}
      </Card>

      {/* Product Details Modal */}
      <Modal open={!!viewProduct} onClose={() => setViewProduct(null)} title={viewProduct?.titulo ?? ''} size="lg">
        {viewProduct && (
          <div className="space-y-5">
            {/* Top badges */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Badge
                  label={viewProduct.ativo ? 'Ativo no Catálogo' : 'Inativo'}
                  color={viewProduct.ativo ? 'text-success-700 bg-success-50' : 'text-slate-500 bg-slate-100'}
                />
                <Badge
                  label={CONCILIATION_CONFIG[viewProduct.conciliacao]?.label ?? viewProduct.conciliacao}
                  color={
                    viewProduct.conciliacao === 'conciliado'
                      ? 'text-success-700 bg-success-50'
                      : viewProduct.conciliacao === 'divergencia_critica'
                      ? 'text-danger-700 bg-danger-50'
                      : 'text-warning-700 bg-warning-50'
                  }
                />
              </div>

              <p className="text-xs text-slate-400">
                Última Atualização: {formatDate(viewProduct.atualizado_em || viewProduct.criado_em)}
              </p>
            </div>

            {/* Official Specs Grid */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <DetailBox label="SKU" value={viewProduct.sku} mono />
              <DetailBox label="EAN" value={viewProduct.ean || '—'} mono />
              <DetailBox label="Código ERP" value={viewProduct.codigo_erp || '—'} mono />
              <DetailBox label="Categoria" value={viewProduct.categoria} />
              <DetailBox label="Marca" value={viewProduct.marca} />
              <DetailBox label="Fornecedor" value={viewProduct.fornecedor} />
            </div>

            {/* ERP vs Marketplace Comparison */}
            <div className="rounded-xl border p-4 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Comparação Operacional (ERP × {viewProduct.marketplace || 'Marketplace'})
                </p>
                {viewProduct.conciliacao !== 'conciliado' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleEqualizeProduct(viewProduct)}
                    loading={resolvingId === viewProduct.id}
                    icon={<RefreshCw className="h-3.5 w-3.5" />}
                  >
                    Equalizar com ERP
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-white p-3 dark:bg-slate-900">
                  <p className="text-xs font-bold text-slate-400">ERP (Sistemas Internos)</p>
                  <div className="mt-2 space-y-1.5 text-sm">
                    <p className="flex justify-between">
                      <span className="text-slate-500">Preço:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {formatCurrency(Number(viewProduct.preco))}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-500">Estoque:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        {formatNumber(viewProduct.estoque)} un
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border bg-white p-3 dark:bg-slate-900">
                  <p className="text-xs font-bold text-slate-400">{viewProduct.marketplace || 'Marketplace'}</p>
                  <div className="mt-2 space-y-1.5 text-sm">
                    <p className="flex justify-between">
                      <span className="text-slate-500">Preço MP:</span>
                      <span
                        className={`font-bold ${
                          viewProduct.preco_marketplace !== null &&
                          Number(viewProduct.preco_marketplace) !== Number(viewProduct.preco)
                            ? 'text-warning-600 dark:text-warning-400'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {viewProduct.preco_marketplace !== null
                          ? formatCurrency(Number(viewProduct.preco_marketplace))
                          : '—'}
                      </span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-500">Estoque MP:</span>
                      <span
                        className={`font-bold ${
                          viewProduct.estoque_marketplace !== null &&
                          viewProduct.estoque_marketplace !== viewProduct.estoque
                            ? 'text-danger-600 dark:text-danger-400'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}
                      >
                        {viewProduct.estoque_marketplace !== null
                          ? `${formatNumber(viewProduct.estoque_marketplace)} un`
                          : '—'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {viewProduct.conciliacao !== 'conciliado' && (
                <div className="mt-3 rounded-lg bg-warning-50 p-2.5 text-xs font-semibold text-warning-700 dark:bg-warning-950 dark:text-warning-300">
                  <AlertTriangle className="mr-1.5 inline h-4 w-4" />
                  {CONCILIATION_CONFIG[viewProduct.conciliacao]?.label ?? viewProduct.conciliacao} identificada no canal.
                </div>
              )}
            </div>

            {/* Financial & Logistic Box */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <DetailBox label="Custo de Aquisição" value={formatCurrency(Number(viewProduct.custo))} />
              <DetailBox
                label="Preço Promocional"
                value={viewProduct.preco_promocional ? formatCurrency(Number(viewProduct.preco_promocional)) : '—'}
              />
              <DetailBox label="Estoque Reservado" value={`${viewProduct.reservado || 0} un`} />
              <DetailBox label="Dimensões (LxAxC / Peso)" value={`${viewProduct.largura_cm}x${viewProduct.altura_cm}x${viewProduct.comprimento_cm} cm (${viewProduct.peso_kg} kg)`} />
            </div>

            {/* Description */}
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Descrição do Produto</p>
              <p className="text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border">
                {viewProduct.descricao || 'Nenhuma descrição técnica informada.'}
              </p>
            </div>

            {/* Product Audit History */}
            <div>
              <p className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <History className="h-4 w-4" /> Histórico de Alterações Registradas
              </p>
              {auditEntries.filter((a) => a.registro.includes(viewProduct.sku)).length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhum evento registrado especificamente para este SKU.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {auditEntries
                    .filter((a) => a.registro.includes(viewProduct.sku))
                    .slice(0, 5)
                    .map((a) => (
                      <div key={a.id} className="rounded-lg border p-2 text-xs bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                          <span>{a.acao} · por {a.usuario}</span>
                          <span>{formatDate(a.criado_em)}</span>
                        </div>
                        <p className="mt-1 text-slate-700 dark:text-slate-300">{a.depois}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="secondary" onClick={() => setViewProduct(null)}>
                Fechar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  openEditModal(viewProduct);
                  setViewProduct(null);
                }}
                icon={<Pencil className="h-4 w-4" />}
              >
                Editar Produto
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Product Edit Modal */}
      <Modal open={!!editingProduct} onClose={() => setEditingProduct(null)} title={`Editar Produto: ${editingProduct?.sku ?? ''}`} size="md">
        {editingProduct && (
          <div className="space-y-4">
            {formError && (
              <div className="rounded-xl bg-danger-50 p-3 text-xs font-semibold text-danger-700 dark:bg-danger-950/50 dark:text-danger-300">
                {formError}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Título do Produto <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                className="input-base text-xs"
                value={editingProduct.titulo}
                onChange={(e) => setEditingProduct({ ...editingProduct, titulo: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  SKU <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-base text-xs font-mono"
                  value={editingProduct.sku}
                  onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  EAN / Código de Barras
                </label>
                <input
                  type="text"
                  className="input-base text-xs font-mono"
                  value={editingProduct.ean || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, ean: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Código ERP
                </label>
                <input
                  type="text"
                  className="input-base text-xs font-mono"
                  value={editingProduct.codigo_erp || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, codigo_erp: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Preço ERP (R$) <span className="text-danger-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-base text-xs"
                  value={editingProduct.preco}
                  onChange={(e) => setEditingProduct({ ...editingProduct, preco: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Preço Marketplace (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-base text-xs"
                  value={editingProduct.preco_marketplace ?? editingProduct.preco}
                  onChange={(e) => setEditingProduct({ ...editingProduct, preco_marketplace: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Estoque ERP (unidades) <span className="text-danger-500">*</span>
                </label>
                <input
                  type="number"
                  className="input-base text-xs"
                  value={editingProduct.estoque}
                  onChange={(e) => setEditingProduct({ ...editingProduct, estoque: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Estoque Marketplace (unidades)
                </label>
                <input
                  type="number"
                  className="input-base text-xs"
                  value={editingProduct.estoque_marketplace ?? editingProduct.estoque}
                  onChange={(e) => setEditingProduct({ ...editingProduct, estoque_marketplace: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Categoria
                </label>
                <input
                  type="text"
                  className="input-base text-xs"
                  value={editingProduct.categoria}
                  onChange={(e) => setEditingProduct({ ...editingProduct, categoria: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Marca
                </label>
                <input
                  type="text"
                  className="input-base text-xs"
                  value={editingProduct.marca}
                  onChange={(e) => setEditingProduct({ ...editingProduct, marca: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Fornecedor
                </label>
                <input
                  type="text"
                  className="input-base text-xs"
                  value={editingProduct.fornecedor}
                  onChange={(e) => setEditingProduct({ ...editingProduct, fornecedor: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="editProductActive"
                checked={editingProduct.ativo}
                onChange={(e) => setEditingProduct({ ...editingProduct, ativo: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
              <label htmlFor="editProductActive" className="text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                Produto Ativo no Catálogo Mestre
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="secondary" onClick={() => setEditingProduct(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSaveEdit} loading={savingEdit} icon={<Save className="h-4 w-4" />}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

function DetailBox({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-100 ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}
