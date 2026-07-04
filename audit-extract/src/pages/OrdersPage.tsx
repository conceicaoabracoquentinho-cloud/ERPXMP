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
import { Eye, Pencil, Trash2, Plus, X, Search, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, OctagonAlert as AlertOctagon, RefreshCw, Download, Package, Clock, Truck, DollarSign, History, User, CreditCard, Ban, RotateCcw, Check, Percent, CirclePlus as PlusCircle, ShoppingBag } from 'lucide-react';
import {
  formatCurrency,
  formatNumber,
  formatDate,
} from '../utils/formatters';
import { matchSearchTerm } from '../utils/normalizers';
import { ORDER_STATUS_CONFIG, CONCILIATION_CONFIG } from '../config/constants';
import { Order, OrderStatus, OrderItem, Product, AuditEntry } from '../types';
import { useAuditContext } from '../hooks/useAuditContext';

interface OrdersPageProps {
  initialSelectedId?: string | null;
}

const ALL_ORDER_STATUSES: OrderStatus[] = [
  'aguardando',
  'pago',
  'faturado',
  'enviado',
  'entregue',
  'cancelado',
  'devolvido',
];

export const OrdersPage: React.FC<OrdersPageProps> = ({ initialSelectedId }) => {
  const toast = useToast();
  const { refreshTrigger, notifyDataChanged } = useSync();
  const auditCtx = useAuditContext();

  // Primary Async States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  // Search & Filter Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [conciliationFilter, setConciliationFilter] = useState('todos');
  const [periodFilter, setPeriodFilter] = useState('todos');
  const [valueRangeFilter, setValueRangeFilter] = useState('todos');
  const [paymentFilter, setPaymentFilter] = useState('todos');
  const [carrierFilter, setCarrierFilter] = useState('todos');

  // Selection & Batch Actions
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Modals
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState<Partial<Order>>({
    numero: '',
    codigo_erp: '',
    marketplace: 'Mercado Livre',
    cliente: '',
    cliente_documento: '',
    status: 'aguardando',
    pagamento: 'PIX',
    envio: 'Mercado Envios',
    transportadora: 'Correios',
    frete: 0,
    comissao: 0,
    desconto: 0,
    itens: [],
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Clear all filters helper
  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setMarketplaceFilter('todos');
    setStatusFilter('todos');
    setConciliationFilter('todos');
    setPeriodFilter('todos');
    setValueRangeFilter('todos');
    setPaymentFilter('todos');
    setCarrierFilter('todos');
  }, []);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordData, prodData, auditData] = await Promise.all([
        apiService.getOrders(),
        apiService.getProducts(),
        apiService.getAuditEntries(),
      ]);
      setOrders(ordData);
      setCatalogProducts(prodData);
      setAuditEntries(auditData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados dos pedidos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  // Handle URL or cross-module selection
  useEffect(() => {
    if (initialSelectedId && orders.length > 0) {
      const found = orders.find(
        (o) =>
          o.id === initialSelectedId ||
          o.numero.toLowerCase() === initialSelectedId.toLowerCase() ||
          (o.codigo_erp && o.codigo_erp.toLowerCase() === initialSelectedId.toLowerCase())
      );
      if (found) {
        clearAllFilters();
        setViewOrder(found);
      }
    }
  }, [initialSelectedId, orders, clearAllFilters]);

  // Unique Options for Filter Dropdowns
  const filterOptions = useMemo(() => {
    const marketplaces = Array.from(new Set(orders.map((o) => o.marketplace).filter(Boolean))).sort();
    const payments = Array.from(new Set(orders.map((o) => o.pagamento).filter(Boolean))).sort();
    const carriers = Array.from(new Set(orders.map((o) => o.transportadora).filter(Boolean))).sort();

    return { marketplaces, payments, carriers };
  }, [orders]);

  // Executive KPI Summary Metrics
  const stats = useMemo(() => {
    const total = orders.length;
    const entregues = orders.filter((o) => o.status === 'entregue').length;
    const pendentes = orders.filter(
      (o) => o.status === 'aguardando' || o.status === 'pago' || o.status === 'faturado'
    ).length;
    const cancelados = orders.filter((o) => o.status === 'cancelado' || o.status === 'devolvido').length;

    const receitaTotal = orders
      .filter((o) => o.status !== 'cancelado')
      .reduce((acc, o) => acc + Number(o.valor), 0);

    const comissaoTotal = orders
      .filter((o) => o.status !== 'cancelado')
      .reduce((acc, o) => acc + Number(o.comissao || 0), 0);

    const lucroEstimado = orders
      .filter((o) => o.status !== 'cancelado')
      .reduce(
        (acc, o) =>
          acc +
          (Number(o.valor) -
            Number(o.comissao || 0) -
            Number(o.frete || 0) -
            Number(o.desconto || 0)),
        0
      );

    const margemMedia = receitaTotal > 0 ? (lucroEstimado / receitaTotal) * 100 : 0;

    return {
      total,
      entregues,
      pendentes,
      cancelados,
      receitaTotal,
      comissaoTotal,
      lucroEstimado,
      margemMedia,
    };
  }, [orders]);

  // Filtered Orders Dataset
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = todayStart - 30 * 24 * 60 * 60 * 1000;

    return orders.filter((o) => {
      // 1. Search Query
      if (searchTerm.trim()) {
        const query = searchTerm.trim();
        const matchesNumero = matchSearchTerm(o.numero, query);
        const matchesErp = matchSearchTerm(o.codigo_erp, query);
        const matchesCliente = matchSearchTerm(o.cliente, query);
        const matchesDoc = matchSearchTerm(o.cliente_documento, query);
        const matchesMarketplace = matchSearchTerm(o.marketplace, query);
        const matchesTransportadora = matchSearchTerm(o.transportadora, query);
        const matchesPagamento = matchSearchTerm(o.pagamento, query);

        // Check inside order items SKU / title
        const matchesItem = o.itens?.some(
          (item) => matchSearchTerm(item.sku, query) || matchSearchTerm(item.titulo, query)
        );

        if (
          !matchesNumero &&
          !matchesErp &&
          !matchesCliente &&
          !matchesDoc &&
          !matchesMarketplace &&
          !matchesTransportadora &&
          !matchesPagamento &&
          !matchesItem
        ) {
          return false;
        }
      }

      // 2. Marketplace Filter
      if (marketplaceFilter !== 'todos' && o.marketplace !== marketplaceFilter) {
        return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'todos' && o.status !== statusFilter) {
        return false;
      }

      // 4. Conciliation Filter
      if (conciliationFilter !== 'todos' && o.conciliacao !== conciliationFilter) {
        return false;
      }

      // 5. Period Filter
      if (periodFilter !== 'todos') {
        const orderTime = new Date(o.data).getTime();
        if (periodFilter === 'hoje' && orderTime < todayStart) return false;
        if (periodFilter === '7dias' && orderTime < sevenDaysAgo) return false;
        if (periodFilter === '30dias' && orderTime < thirtyDaysAgo) return false;
      }

      // 6. Value Range Filter
      const valor = Number(o.valor);
      if (valueRangeFilter === 'ate_100' && valor > 100) return false;
      if (valueRangeFilter === '100_500' && (valor < 100 || valor > 500)) return false;
      if (valueRangeFilter === '500_2000' && (valor < 500 || valor > 2000)) return false;
      if (valueRangeFilter === 'acima_2000' && valor <= 2000) return false;

      // 7. Payment Filter
      if (paymentFilter !== 'todos' && o.pagamento !== paymentFilter) {
        return false;
      }

      // 8. Carrier Filter
      if (carrierFilter !== 'todos' && o.transportadora !== carrierFilter) {
        return false;
      }

      return true;
    });
  }, [
    orders,
    searchTerm,
    marketplaceFilter,
    statusFilter,
    conciliationFilter,
    periodFilter,
    valueRangeFilter,
    paymentFilter,
    carrierFilter,
  ]);

  const hasActiveFilters =
    searchTerm !== '' ||
    marketplaceFilter !== 'todos' ||
    statusFilter !== 'todos' ||
    conciliationFilter !== 'todos' ||
    periodFilter !== 'todos' ||
    valueRangeFilter !== 'todos' ||
    paymentFilter !== 'todos' ||
    carrierFilter !== 'todos';

  // Status Change Logic
  const handleUpdateOrderStatus = async (order: Order, newStatus: OrderStatus) => {
    setUpdatingStatusId(order.id);
    try {
      const isEntregue = newStatus === 'entregue';
      const newConciliation = isEntregue ? 'conciliado' : order.conciliacao;

      await apiService.updateOrder(order.id, {
        status: newStatus,
        conciliacao: newConciliation,
      });

      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'alteracao_status_pedido',
        modulo: 'Pedidos',
        registro: order.numero,
        antes: `Status: ${ORDER_STATUS_CONFIG[order.status]?.label ?? order.status}`,
        depois: `Status: ${ORDER_STATUS_CONFIG[newStatus]?.label ?? newStatus}`,
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });

      toast.success(
        `Pedido ${order.numero} alterado para "${ORDER_STATUS_CONFIG[newStatus]?.label ?? newStatus}"!`
      );

      notifyDataChanged();

      if (viewOrder?.id === order.id) {
        setViewOrder((prev) =>
          prev ? { ...prev, status: newStatus, conciliacao: newConciliation } : null
        );
      }
    } catch {
      toast.error(`Erro ao atualizar status do pedido ${order.numero}.`);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Batch Status Change
  const handleBatchStatusChange = async (newStatus: OrderStatus) => {
    if (selectedOrderIds.length === 0) return;
    setBatchActionLoading(true);
    try {
      for (const id of selectedOrderIds) {
        const order = orders.find((o) => o.id === id);
        if (order) {
          await apiService.updateOrder(order.id, {
            status: newStatus,
            conciliacao: newStatus === 'entregue' ? 'conciliado' : order.conciliacao,
          });
          await apiService.insertAudit({
            usuario: auditCtx.usuario,
            acao: 'alteracao_status_lote',
            modulo: 'Pedidos',
            registro: order.numero,
            antes: order.status,
            depois: newStatus,
            ip: auditCtx.ip,
            navegador: auditCtx.navegador,
          });
        }
      }
      toast.success(
        `${selectedOrderIds.length} pedido(s) alterado(s) para "${ORDER_STATUS_CONFIG[newStatus]?.label ?? newStatus}"!`
      );
      setSelectedOrderIds([]);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao processar alteração em lote.');
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Export to CSV
  const handleExportCSV = (dataset: Order[]) => {
    if (dataset.length === 0) {
      toast.info('Nenhum pedido para exportar.');
      return;
    }

    const headers = [
      'Numero',
      'Codigo_ERP',
      'Marketplace',
      'Cliente',
      'Documento',
      'Valor_Bruto',
      'Frete',
      'Comissao',
      'Desconto',
      'Status',
      'Pagamento',
      'Transportadora',
      'Conciliacao',
      'Data_Emissao',
    ];

    const rows = dataset.map((o) => [
      `"${o.numero}"`,
      `"${o.codigo_erp || ''}"`,
      `"${o.marketplace}"`,
      `"${o.cliente.replace(/"/g, '""')}"`,
      `"${o.cliente_documento || ''}"`,
      Number(o.valor).toFixed(2),
      Number(o.frete).toFixed(2),
      Number(o.comissao).toFixed(2),
      Number(o.desconto).toFixed(2),
      `"${ORDER_STATUS_CONFIG[o.status]?.label ?? o.status}"`,
      `"${o.pagamento}"`,
      `"${o.transportadora}"`,
      `"${CONCILIATION_CONFIG[o.conciliacao]?.label ?? o.conciliacao}"`,
      `"${o.data}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pedidos_vendas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`${dataset.length} pedido(s) exportado(s) com sucesso!`);
  };  // Delete / Cancel Order Confirmation
  const handleDeleteOrder = async (orderId: string) => {
    if (deleting) return;
    setDeleting(true);
    const target = orders.find((o) => o.id === orderId);
    try {
      await apiService.deleteOrder(orderId);
      if (target) {
        await apiService.insertAudit({
          usuario: auditCtx.usuario,
          acao: 'exclusao_pedido',
          modulo: 'Pedidos',
          registro: target.numero,
          antes: `Valor R$ ${target.valor} | Status: ${target.status}`,
          depois: 'Registro Excluído',
          ip: auditCtx.ip,
          navegador: auditCtx.navegador,
        });
      }
      toast.success('Pedido removido com sucesso!');
      setDeleteConfirmId(null);
      if (viewOrder?.id === orderId) setViewOrder(null);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao excluir pedido.');
    } finally {
      setDeleting(false);
    }
  };

  // Open Edit Order Modal
  const openEditModal = (order: Order) => {
    setEditingOrder(JSON.parse(JSON.stringify(order)));
    setFormError(null);
  };

  // Save Order Edits
  const handleSaveEditOrder = async () => {
    if (!editingOrder) return;
    if (!editingOrder.numero.trim()) {
      setFormError('Número do pedido é obrigatório.');
      return;
    }
    if (!editingOrder.cliente.trim()) {
      setFormError('Nome do cliente é obrigatório.');
      return;
    }
    if (isNaN(Number(editingOrder.valor)) || Number(editingOrder.valor) < 0) {
      setFormError('Valor do pedido deve ser um número válido maior ou igual a zero.');
      return;
    }
    if (isNaN(Number(editingOrder.frete)) || Number(editingOrder.frete) < 0) {
      setFormError('Valor do frete deve ser um número válido maior ou igual a zero.');
      return;
    }
    if (isNaN(Number(editingOrder.comissao)) || Number(editingOrder.comissao) < 0) {
      setFormError('Valor da comissão deve ser um número válido maior ou igual a zero.');
      return;
    }
    if (isNaN(Number(editingOrder.desconto)) || Number(editingOrder.desconto) < 0) {
      setFormError('Valor do desconto deve ser um número válido maior ou igual a zero.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      // Recalculate totals if items exist
      let recalculatedValor = Number(editingOrder.valor);
      if (editingOrder.itens && editingOrder.itens.length > 0) {
        recalculatedValor = editingOrder.itens.reduce((acc, item) => acc + Number(item.subtotal), 0);
      }

      await apiService.updateOrder(editingOrder.id, {
        ...editingOrder,
        valor: recalculatedValor,
        frete: Number(editingOrder.frete),
        comissao: Number(editingOrder.comissao),
        desconto: Number(editingOrder.desconto),
      });

      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'edicao_pedido',
        modulo: 'Pedidos',
        registro: editingOrder.numero,
        antes: 'Dados anteriores',
        depois: `Valor: R$ ${recalculatedValor} | Status: ${editingOrder.status} | Cliente: ${editingOrder.cliente}`,
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });

      toast.success(`Pedido ${editingOrder.numero} atualizado com sucesso!`);
      setEditingOrder(null);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao salvar alterações do pedido.');
    } finally {
      setSaving(false);
    }
  };

  // Open Create Order Modal
  const openCreateModal = () => {
    const defaultNum = `PED-${Date.now().toString().slice(-5)}`;
    setNewOrderForm({
      numero: defaultNum,
      codigo_erp: `ERP-${defaultNum}`,
      marketplace: 'Mercado Livre',
      cliente: '',
      cliente_documento: '',
      status: 'aguardando',
      pagamento: 'PIX',
      envio: 'Mercado Envios',
      transportadora: 'Correios',
      frete: 0,
      comissao: 0,
      desconto: 0,
      itens: [],
      conciliacao: 'conciliado',
    });
    setFormError(null);
    setIsCreating(true);
  };

  // Save New Order
  const handleCreateOrder = async () => {
    if (!newOrderForm.numero?.trim()) {
      setFormError('Número do pedido é obrigatório.');
      return;
    }
    if (!newOrderForm.cliente?.trim()) {
      setFormError('Nome do cliente é obrigatório.');
      return;
    }
    if (isNaN(Number(newOrderForm.frete)) || Number(newOrderForm.frete) < 0) {
      setFormError('Valor do frete deve ser um número válido maior ou igual a zero.');
      return;
    }
    if (isNaN(Number(newOrderForm.comissao)) || Number(newOrderForm.comissao) < 0) {
      setFormError('Valor da comissão deve ser um número válido maior ou igual a zero.');
      return;
    }
    if (isNaN(Number(newOrderForm.desconto)) || Number(newOrderForm.desconto) < 0) {
      setFormError('Valor do desconto deve ser um número válido maior ou igual a zero.');
      return;
    }

    const items = newOrderForm.itens || [];
    const valorBruto = items.reduce((sum, item) => sum + Number(item.subtotal), 0);

    setSaving(true);
    setFormError(null);
    try {
      const created = await apiService.createOrder({
        numero: newOrderForm.numero.trim(),
        codigo_erp: newOrderForm.codigo_erp?.trim() || `ERP-${newOrderForm.numero.trim()}`,
        marketplace: newOrderForm.marketplace || 'Mercado Livre',
        cliente: newOrderForm.cliente.trim(),
        cliente_documento: newOrderForm.cliente_documento?.trim() || '',
        valor: valorBruto > 0 ? valorBruto : 100,
        frete: Number(newOrderForm.frete || 0),
        comissao: Number(newOrderForm.comissao || 0),
        desconto: Number(newOrderForm.desconto || 0),
        status: (newOrderForm.status as OrderStatus) || 'aguardando',
        pagamento: newOrderForm.pagamento || 'PIX',
        envio: newOrderForm.envio || 'Mercado Envios',
        transportadora: newOrderForm.transportadora || 'Correios',
        conciliacao: 'conciliado',
        data: new Date().toISOString(),
        itens: items,
        itens_qtd: items.reduce((sum, item) => sum + item.quantidade, 0),
      });

      await apiService.insertAudit({
        usuario: auditCtx.usuario,
        acao: 'criacao_pedido',
        modulo: 'Pedidos',
        registro: created.numero,
        antes: 'Nenhum',
        depois: `Novo Pedido R$ ${created.valor} | Cliente: ${created.cliente}`,
        ip: auditCtx.ip,
        navegador: auditCtx.navegador,
      });

      toast.success(`Pedido ${created.numero} criado com sucesso!`);
      setIsCreating(false);
      notifyDataChanged();
    } catch {
      toast.error('Erro ao criar novo pedido.');
    } finally {
      setSaving(false);
    }
  };

  // Helper: Add product item to an order form
  const addItemToOrder = (
    target: Partial<Order>,
    setTarget: React.Dispatch<React.SetStateAction<any>>,
    product: Product
  ) => {
    const currentItems = target.itens || [];
    const existingIndex = currentItems.findIndex((i) => i.sku === product.sku);

    let nextItems: OrderItem[] = [];
    if (existingIndex >= 0) {
      nextItems = currentItems.map((item, idx) => {
        if (idx === existingIndex) {
          const nextQty = item.quantidade + 1;
          const subtotal = nextQty * item.preco_unitario - (item.desconto_unitario || 0) * nextQty;
          return { ...item, quantidade: nextQty, subtotal };
        }
        return item;
      });
    } else {
      const price = Number(product.preco);
      nextItems = [
        ...currentItems,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          sku: product.sku,
          titulo: product.titulo,
          quantidade: 1,
          preco_unitario: price,
          desconto_unitario: 0,
          subtotal: price,
        },
      ];
    }

    const calculatedValor = nextItems.reduce((acc, item) => acc + Number(item.subtotal), 0);
    const estComissao = Number((calculatedValor * 0.12).toFixed(2)); // ~12% marketplace commission estimate

    setTarget({
      ...target,
      itens: nextItems,
      valor: calculatedValor,
      comissao: estComissao,
    });
  };

  // Helper: Remove product item from order
  const removeItemFromOrder = (
    target: Partial<Order>,
    setTarget: React.Dispatch<React.SetStateAction<any>>,
    itemId: string
  ) => {
    const nextItems = (target.itens || []).filter((i) => i.id !== itemId);
    const calculatedValor = nextItems.reduce((acc, item) => acc + Number(item.subtotal), 0);
    const estComissao = Number((calculatedValor * 0.12).toFixed(2));

    setTarget({
      ...target,
      itens: nextItems,
      valor: calculatedValor,
      comissao: estComissao,
    });
  };

  // Helper: Update item in order form
  const updateOrderItem = (
    target: Partial<Order>,
    setTarget: React.Dispatch<React.SetStateAction<any>>,
    itemId: string,
    field: 'quantidade' | 'preco_unitario' | 'desconto_unitario',
    value: number
  ) => {
    const nextItems = (target.itens || []).map((item) => {
      if (item.id === itemId) {
        const qty = field === 'quantidade' ? Math.max(1, value) : item.quantidade;
        const unitPrice = field === 'preco_unitario' ? Math.max(0, value) : item.preco_unitario;
        const discount = field === 'desconto_unitario' ? Math.max(0, value) : item.desconto_unitario || 0;

        const subtotal = Number((qty * unitPrice - discount * qty).toFixed(2));
        return {
          ...item,
          quantidade: qty,
          preco_unitario: unitPrice,
          desconto_unitario: discount,
          subtotal: subtotal > 0 ? subtotal : 0,
        };
      }
      return item;
    });

    const calculatedValor = nextItems.reduce((acc, item) => acc + Number(item.subtotal), 0);
    const estComissao = Number((calculatedValor * 0.12).toFixed(2));

    setTarget({
      ...target,
      itens: nextItems,
      valor: calculatedValor,
      comissao: estComissao,
    });
  };

  // Table Columns Setup
  const columns: Column<Order>[] = [
    {
      key: 'numero',
      header: 'Pedido',
      sortable: true,
      render: (o) => (
        <div>
          <p className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{o.numero}</p>
          <p className="text-[10px] text-slate-400 font-mono">{o.codigo_erp || '—'}</p>
        </div>
      ),
    },
    {
      key: 'marketplace',
      header: 'Canal / MP',
      sortable: true,
      render: (o) => (
        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <ShoppingBag className="h-3 w-3 text-slate-400" />
          {o.marketplace}
        </span>
      ),
    },
    {
      key: 'cliente',
      header: 'Cliente',
      sortable: true,
      render: (o) => (
        <div className="max-w-[160px] truncate">
          <p className="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate">{o.cliente}</p>
          <p className="text-[10px] text-slate-400 font-mono">{o.cliente_documento || 'Sem doc.'}</p>
        </div>
      ),
    },
    {
      key: 'valor',
      header: 'Valor Bruto',
      sortable: true,
      render: (o) => (
        <div>
          <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
            {formatCurrency(Number(o.valor))}
          </span>
          {o.desconto > 0 && (
            <span className="block text-[10px] text-danger-500">
              desc. {formatCurrency(Number(o.desconto))}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'frete',
      header: 'Frete & Comissão',
      render: (o) => (
        <div className="text-[11px] text-slate-600 dark:text-slate-300">
          <p>Frete: {formatCurrency(Number(o.frete))}</p>
          <p className="text-slate-400">Com: {formatCurrency(Number(o.comissao))}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status Operacional',
      sortable: true,
      render: (o) => {
        const cfg = ORDER_STATUS_CONFIG[o.status] ?? ORDER_STATUS_CONFIG.aguardando;
        return (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${cfg.color}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {cfg.label}
          </span>
        );
      },
    },
    {
      key: 'conciliacao',
      header: 'Conciliação',
      sortable: true,
      render: (o) => {
        const cfg = CONCILIATION_CONFIG[o.conciliacao] ?? CONCILIATION_CONFIG.ausente;
        return <Badge label={cfg.label} color={cfg.color} />;
      },
    },
    {
      key: 'data',
      header: 'Emissão',
      sortable: true,
      render: (o) => (
        <span className="text-xs text-slate-600 dark:text-slate-300">{formatDate(o.data)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (o) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewOrder(o)}
            title="Ver detalhes completos"
            className="p-1.5"
          >
            <Eye className="h-4 w-4 text-slate-500" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(o)}
            title="Editar pedido"
            className="p-1.5"
          >
            <Pencil className="h-4 w-4 text-slate-500" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteConfirmId(o.id)}
            title="Excluir pedido"
            className="p-1.5 text-danger-500 hover:bg-danger-50"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner message="Carregando módulo de pedidos e conciliador..." />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      {/* Module Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Gestão de Pedidos Omnichannel
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Acompanhamento em tempo real, fluxo de faturamento, expedição e conciliação financeira
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={loadData} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            Sincronizar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExportCSV(filteredOrders)}
            icon={<Download className="h-3.5 w-3.5" />}
          >
            Exportar CSV
          </Button>
          <Button variant="primary" size="sm" onClick={openCreateModal} icon={<Plus className="h-3.5 w-3.5" />}>
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Top Summary Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Pedidos</p>
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
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Entregues</p>
              <p className="text-xl font-bold text-success-600 dark:text-success-400">{formatNumber(stats.entregues)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-950 dark:text-warning-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Em Processamento</p>
              <p className="text-xl font-bold text-warning-600 dark:text-warning-400">{formatNumber(stats.pendentes)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Volume Bruto</p>
              <p className="text-lg font-bold text-brand-600 dark:text-brand-400">{formatCurrency(stats.receitaTotal)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-950 dark:text-success-400">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Margem Média</p>
              <p className="text-lg font-bold text-success-600 dark:text-success-400">{stats.margemMedia.toFixed(1)}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Advanced Filter Bar */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                className="input-base pl-9 pr-8 text-xs"
                placeholder="Pesquisar por N° do pedido (ex: PED-ML-8941), Código ERP, Cliente, CPF/CNPJ, SKU, Produto, Transportadora..."
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

          {/* Filter Select Dropdowns Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <select
              className="input-base text-[11px] py-1.5"
              value={marketplaceFilter}
              onChange={(e) => setMarketplaceFilter(e.target.value)}
            >
              <option value="todos">Marketplace: Todos</option>
              {filterOptions.marketplaces.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="todos">Status: Todos</option>
              {ALL_ORDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {ORDER_STATUS_CONFIG[st]?.label ?? st}
                </option>
              ))}
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={conciliationFilter}
              onChange={(e) => setConciliationFilter(e.target.value)}
            >
              <option value="todos">Conciliação: Todas</option>
              <option value="conciliado">Conciliado</option>
              <option value="divergencia_leve">Divergência Leve</option>
              <option value="divergencia_critica">Divergência Crítica</option>
              <option value="ausente">Ausente</option>
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
            >
              <option value="todos">Período: Todo o histórico</option>
              <option value="hoje">Hoje</option>
              <option value="7dias">Últimos 7 dias</option>
              <option value="30dias">Últimos 30 dias</option>
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={valueRangeFilter}
              onChange={(e) => setValueRangeFilter(e.target.value)}
            >
              <option value="todos">Faixa de Valor: Todas</option>
              <option value="ate_100">Até R$ 100</option>
              <option value="100_500">R$ 100 – R$ 500</option>
              <option value="500_2000">R$ 500 – R$ 2.000</option>
              <option value="acima_2000">Acima de R$ 2.000</option>
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="todos">Pagamento: Todos</option>
              {filterOptions.payments.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              className="input-base text-[11px] py-1.5"
              value={carrierFilter}
              onChange={(e) => setCarrierFilter(e.target.value)}
            >
              <option value="todos">Transportadora: Todas</option>
              {filterOptions.carriers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Batch Actions Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3.5 dark:border-brand-900 dark:bg-brand-950/50">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {selectedOrderIds.length}
            </span>
            <span className="text-xs font-bold text-brand-900 dark:text-brand-100">
              pedido(s) selecionado(s)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Alterar status em lote:</span>
            <Button
              variant="secondary"
              size="sm"
              loading={batchActionLoading}
              onClick={() => handleBatchStatusChange('faturado')}
            >
              Marcar Faturado
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={batchActionLoading}
              onClick={() => handleBatchStatusChange('enviado')}
            >
              Marcar Enviado
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={batchActionLoading}
              onClick={() => handleBatchStatusChange('entregue')}
            >
              Marcar Entregue
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                handleExportCSV(orders.filter((o) => selectedOrderIds.includes(o.id)))
              }
              icon={<Download className="h-3.5 w-3.5" />}
            >
              Exportar CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedOrderIds([])}>
              Desmarcar
            </Button>
          </div>
        </div>
      )}

      {/* Main Orders Table */}
      <Card
        title="Listagem Geral de Pedidos"
        description={`Exibindo ${filteredOrders.length} de ${orders.length} pedidos cadastrados`}
      >
        {filteredOrders.length === 0 ? (
          <EmptyState
            title="Nenhum pedido encontrado"
            description="Não foram encontrados pedidos com os filtros selecionados. Clique em 'Limpar Filtros' para visualizar todos os pedidos."
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredOrders}
            getRowId={(o) => o.id}
            pageSize={10}
            searchable={false}
            onSelectionChange={(ids) => setSelectedOrderIds(ids)}
          />
        )}
      </Card>

      {/* Order Details Modal */}
      <Modal open={!!viewOrder} onClose={() => setViewOrder(null)} title={`Pedido: ${viewOrder?.numero ?? ''}`} size="lg">
        {viewOrder && (
          <div className="space-y-5">
            {/* Modal Header Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                    ORDER_STATUS_CONFIG[viewOrder.status]?.color ?? 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {ORDER_STATUS_CONFIG[viewOrder.status]?.label ?? viewOrder.status}
                </span>
                <Badge
                  label={CONCILIATION_CONFIG[viewOrder.conciliacao]?.label ?? viewOrder.conciliacao}
                  color={CONCILIATION_CONFIG[viewOrder.conciliacao]?.color ?? 'text-slate-500 bg-slate-100'}
                />
              </div>

              <p className="text-xs text-slate-400">
                Data do Pedido: {formatDate(viewOrder.data)}
              </p>
            </div>

            {/* Operational Status Flow Stepper */}
            <div className="rounded-xl border p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Avanço Operacional do Pedido
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {(['aguardando', 'pago', 'faturado', 'enviado', 'entregue'] as OrderStatus[]).map((st) => {
                  const isActive = viewOrder.status === st;
                  return (
                    <Button
                      key={st}
                      variant={isActive ? 'primary' : 'secondary'}
                      size="sm"
                      loading={updatingStatusId === viewOrder.id}
                      onClick={() => handleUpdateOrderStatus(viewOrder, st)}
                      className="text-xs"
                    >
                      {isActive && <Check className="mr-1 h-3.5 w-3.5" />}
                      {ORDER_STATUS_CONFIG[st]?.label}
                    </Button>
                  );
                })}

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant={viewOrder.status === 'cancelado' ? 'danger' : 'ghost'}
                    size="sm"
                    loading={updatingStatusId === viewOrder.id}
                    onClick={() => handleUpdateOrderStatus(viewOrder, 'cancelado')}
                    className="text-xs text-danger-600 hover:bg-danger-50"
                    icon={<Ban className="h-3.5 w-3.5" />}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant={viewOrder.status === 'devolvido' ? 'danger' : 'ghost'}
                    size="sm"
                    loading={updatingStatusId === viewOrder.id}
                    onClick={() => handleUpdateOrderStatus(viewOrder, 'devolvido')}
                    className="text-xs text-warning-600 hover:bg-warning-50"
                    icon={<RotateCcw className="h-3.5 w-3.5" />}
                  >
                    Devolvido
                  </Button>
                </div>
              </div>
            </div>

            {/* Customer & Operational Specs Grid */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <OrderBox label="Número do Pedido" value={viewOrder.numero} mono />
              <OrderBox label="Código ERP" value={viewOrder.codigo_erp || '—'} mono />
              <OrderBox label="Marketplace / Canal" value={viewOrder.marketplace} />
              <OrderBox label="Forma de Pagamento" value={viewOrder.pagamento} />

              <OrderBox label="Cliente" value={viewOrder.cliente} />
              <OrderBox label="Documento (CPF/CNPJ)" value={viewOrder.cliente_documento || '—'} mono />
              <OrderBox label="Transportadora" value={viewOrder.transportadora} />
              <OrderBox label="Método de Envio" value={viewOrder.envio} />
            </div>

            {/* Order Items Breakdown */}
            <div>
              <p className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Package className="h-4 w-4 text-brand-600" /> Produtos e Itens do Pedido
              </p>

              {!viewOrder.itens || viewOrder.itens.length === 0 ? (
                <div className="rounded-lg border p-3 text-xs text-slate-500 italic bg-slate-50 dark:bg-slate-900">
                  Nenhum item discriminado no registro do pedido.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500">
                      <tr>
                        <th className="p-2.5">SKU</th>
                        <th className="p-2.5">Produto</th>
                        <th className="p-2.5 text-center">Qtd</th>
                        <th className="p-2.5 text-right">Preço Unit.</th>
                        <th className="p-2.5 text-right">Desconto</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {viewOrder.itens.map((item) => (
                        <tr key={item.id}>
                          <td className="p-2.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {item.sku}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-100">
                            {item.titulo}
                          </td>
                          <td className="p-2.5 text-center font-bold">{item.quantidade}</td>
                          <td className="p-2.5 text-right">{formatCurrency(item.preco_unitario)}</td>
                          <td className="p-2.5 text-right text-danger-500">
                            {item.desconto_unitario ? formatCurrency(item.desconto_unitario) : '—'}
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-900 dark:text-slate-100">
                            {formatCurrency(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Financial Breakdown Card */}
            <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-800/50">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Detalhamento Financeiro do Pedido
              </p>
              <div className="space-y-2 text-xs sm:text-sm">
                <FinancialRow label="Valor Bruto dos Produtos" value={formatCurrency(Number(viewOrder.valor))} />
                <FinancialRow label="Frete Pago pelo Cliente" value={`+ ${formatCurrency(Number(viewOrder.frete))}`} />
                <FinancialRow label="Comissão Retida pelo Canal" value={`- ${formatCurrency(Number(viewOrder.comissao))}`} />
                <FinancialRow label="Descontos / Cupons Aplicados" value={`- ${formatCurrency(Number(viewOrder.desconto))}`} />

                <div className="border-t pt-2 mt-2">
                  <FinancialRow
                    label="Receita Líquida Estimada"
                    value={formatCurrency(
                      Number(viewOrder.valor) -
                        Number(viewOrder.comissao) -
                        Number(viewOrder.frete) -
                        Number(viewOrder.desconto)
                    )}
                    bold
                  />
                </div>
              </div>
            </div>

            {/* Order Audit History */}
            <div>
              <p className="mb-2 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <History className="h-4 w-4" /> Trilha de Auditoria do Pedido
              </p>
              {auditEntries.filter((a) => a.registro.includes(viewOrder.numero)).length === 0 ? (
                <p className="text-xs text-slate-400 italic">Nenhum evento registrado para este pedido.</p>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto">
                  {auditEntries
                    .filter((a) => a.registro.includes(viewOrder.numero))
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
              <Button variant="secondary" onClick={() => setViewOrder(null)}>
                Fechar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  openEditModal(viewOrder);
                  setViewOrder(null);
                }}
                icon={<Pencil className="h-4 w-4" />}
              >
                Editar Pedido
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Order Modal */}
      <Modal open={isCreating} onClose={() => setIsCreating(false)} title="Novo Pedido de Venda" size="lg">
        <div className="space-y-4">
          {formError && (
            <div className="rounded-xl bg-danger-50 p-3 text-xs font-semibold text-danger-700 dark:bg-danger-950/50 dark:text-danger-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                N° do Pedido <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                className="input-base text-xs font-mono"
                value={newOrderForm.numero || ''}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, numero: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Código ERP
              </label>
              <input
                type="text"
                className="input-base text-xs font-mono"
                value={newOrderForm.codigo_erp || ''}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, codigo_erp: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Marketplace <span className="text-danger-500">*</span>
              </label>
              <select
                className="input-base text-xs"
                value={newOrderForm.marketplace}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, marketplace: e.target.value })}
              >
                <option value="Mercado Livre">Mercado Livre</option>
                <option value="Amazon">Amazon</option>
                <option value="Shopee">Shopee</option>
                <option value="Magalu">Magalu</option>
                <option value="Loja Virtual">Loja Virtual</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Status Inicial
              </label>
              <select
                className="input-base text-xs"
                value={newOrderForm.status}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, status: e.target.value as OrderStatus })}
              >
                {ALL_ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {ORDER_STATUS_CONFIG[st]?.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Cliente <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                className="input-base text-xs"
                placeholder="Nome do cliente"
                value={newOrderForm.cliente || ''}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, cliente: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Documento (CPF / CNPJ)
              </label>
              <input
                type="text"
                className="input-base text-xs font-mono"
                placeholder="000.000.000-00"
                value={newOrderForm.cliente_documento || ''}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, cliente_documento: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Forma de Pagamento
              </label>
              <input
                type="text"
                className="input-base text-xs"
                value={newOrderForm.pagamento || ''}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, pagamento: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Transportadora
              </label>
              <input
                type="text"
                className="input-base text-xs"
                value={newOrderForm.transportadora || ''}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, transportadora: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Método de Envio
              </label>
              <input
                type="text"
                className="input-base text-xs"
                value={newOrderForm.envio || ''}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, envio: e.target.value })}
              />
            </div>
          </div>

          {/* Add Products from Catalog */}
          <div className="rounded-xl border p-3.5 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Adicionar Produtos do Catálogo ao Pedido
            </p>
            <div className="flex flex-wrap items-center gap-2 max-h-28 overflow-y-auto">
              {catalogProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addItemToOrder(newOrderForm, setNewOrderForm, p)}
                  className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 text-xs hover:border-brand-500 hover:text-brand-600 dark:bg-slate-900 dark:border-slate-700"
                >
                  <PlusCircle className="h-3.5 w-3.5 text-brand-500" />
                  <span className="font-mono font-bold">{p.sku}:</span>
                  <span className="truncate max-w-[120px]">{p.titulo}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 ml-1">
                    {formatCurrency(Number(p.preco))}
                  </span>
                </button>
              ))}
            </div>

            {/* Items Table in Create Modal */}
            {newOrderForm.itens && newOrderForm.itens.length > 0 && (
              <div className="overflow-hidden rounded-lg border bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="p-2">SKU</th>
                      <th className="p-2">Produto</th>
                      <th className="p-2 text-center w-20">Qtd</th>
                      <th className="p-2 text-right w-24">Preço Unit.</th>
                      <th className="p-2 text-right w-24">Subtotal</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {newOrderForm.itens.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2 font-mono font-bold">{item.sku}</td>
                        <td className="p-2 truncate max-w-[150px]">{item.titulo}</td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            min="1"
                            className="input-base text-xs text-center py-0.5 px-1 w-14"
                            value={item.quantidade}
                            onChange={(e) =>
                              updateOrderItem(
                                newOrderForm,
                                setNewOrderForm,
                                item.id,
                                'quantidade',
                                Number(e.target.value)
                              )
                            }
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            className="input-base text-xs text-right py-0.5 px-1 w-20"
                            value={item.preco_unitario}
                            onChange={(e) =>
                              updateOrderItem(
                                newOrderForm,
                                setNewOrderForm,
                                item.id,
                                'preco_unitario',
                                Number(e.target.value)
                              )
                            }
                          />
                        </td>
                        <td className="p-2 text-right font-bold">{formatCurrency(item.subtotal)}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemFromOrder(newOrderForm, setNewOrderForm, item.id)}
                            className="text-danger-500 hover:text-danger-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Financial Totals */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Valor Bruto (R$)
              </label>
              <input
                type="number"
                step="0.01"
                className="input-base text-xs font-bold"
                value={newOrderForm.valor || 0}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, valor: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Frete (R$)
              </label>
              <input
                type="number"
                step="0.01"
                className="input-base text-xs"
                value={newOrderForm.frete || 0}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, frete: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Comissão Canal (R$)
              </label>
              <input
                type="number"
                step="0.01"
                className="input-base text-xs"
                value={newOrderForm.comissao || 0}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, comissao: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="secondary" onClick={() => setIsCreating(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleCreateOrder} loading={saving} icon={<Plus className="h-4 w-4" />}>
              Criar Pedido
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Order Modal */}
      <Modal open={!!editingOrder} onClose={() => setEditingOrder(null)} title={`Editar Pedido: ${editingOrder?.numero ?? ''}`} size="lg">
        {editingOrder && (
          <div className="space-y-4">
            {formError && (
              <div className="rounded-xl bg-danger-50 p-3 text-xs font-semibold text-danger-700 dark:bg-danger-950/50 dark:text-danger-300">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  N° do Pedido <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-base text-xs font-mono"
                  value={editingOrder.numero}
                  onChange={(e) => setEditingOrder({ ...editingOrder, numero: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Código ERP
                </label>
                <input
                  type="text"
                  className="input-base text-xs font-mono"
                  value={editingOrder.codigo_erp || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, codigo_erp: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Marketplace
                </label>
                <input
                  type="text"
                  className="input-base text-xs"
                  value={editingOrder.marketplace}
                  onChange={(e) => setEditingOrder({ ...editingOrder, marketplace: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Status Operacional
                </label>
                <select
                  className="input-base text-xs"
                  value={editingOrder.status}
                  onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value as OrderStatus })}
                >
                  {ALL_ORDER_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {ORDER_STATUS_CONFIG[st]?.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Cliente <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  className="input-base text-xs"
                  value={editingOrder.cliente}
                  onChange={(e) => setEditingOrder({ ...editingOrder, cliente: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Documento (CPF / CNPJ)
                </label>
                <input
                  type="text"
                  className="input-base text-xs font-mono"
                  value={editingOrder.cliente_documento || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, cliente_documento: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Forma de Pagamento
                </label>
                <input
                  type="text"
                  className="input-base text-xs"
                  value={editingOrder.pagamento}
                  onChange={(e) => setEditingOrder({ ...editingOrder, pagamento: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Transportadora
                </label>
                <input
                  type="text"
                  className="input-base text-xs"
                  value={editingOrder.transportadora}
                  onChange={(e) => setEditingOrder({ ...editingOrder, transportadora: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Método de Envio
                </label>
                <input
                  type="text"
                  className="input-base text-xs"
                  value={editingOrder.envio}
                  onChange={(e) => setEditingOrder({ ...editingOrder, envio: e.target.value })}
                />
              </div>
            </div>

            {/* Product Items Editor */}
            <div className="rounded-xl border p-3.5 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Editar Produtos e Quantidades do Pedido
              </p>

              <div className="flex flex-wrap items-center gap-2 max-h-24 overflow-y-auto">
                {catalogProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addItemToOrder(editingOrder, setEditingOrder, p)}
                    className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 text-xs hover:border-brand-500 hover:text-brand-600 dark:bg-slate-900 dark:border-slate-700"
                  >
                    <PlusCircle className="h-3.5 w-3.5 text-brand-500" />
                    <span className="font-mono font-bold">{p.sku}:</span>
                    <span className="truncate max-w-[100px]">{p.titulo}</span>
                  </button>
                ))}
              </div>

              {editingOrder.itens && editingOrder.itens.length > 0 && (
                <div className="overflow-hidden rounded-lg border bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Produto</th>
                        <th className="p-2 text-center w-20">Qtd</th>
                        <th className="p-2 text-right w-24">Preço Unit.</th>
                        <th className="p-2 text-right w-24">Subtotal</th>
                        <th className="p-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {editingOrder.itens.map((item) => (
                        <tr key={item.id}>
                          <td className="p-2 font-mono font-bold">{item.sku}</td>
                          <td className="p-2 truncate max-w-[150px]">{item.titulo}</td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="1"
                              className="input-base text-xs text-center py-0.5 px-1 w-14"
                              value={item.quantidade}
                              onChange={(e) =>
                                updateOrderItem(
                                  editingOrder,
                                  setEditingOrder,
                                  item.id,
                                  'quantidade',
                                  Number(e.target.value)
                                )
                              }
                            />
                          </td>
                          <td className="p-2 text-right">
                            <input
                              type="number"
                              step="0.01"
                              className="input-base text-xs text-right py-0.5 px-1 w-20"
                              value={item.preco_unitario}
                              onChange={(e) =>
                                updateOrderItem(
                                  editingOrder,
                                  setEditingOrder,
                                  item.id,
                                  'preco_unitario',
                                  Number(e.target.value)
                                )
                              }
                            />
                          </td>
                          <td className="p-2 text-right font-bold">{formatCurrency(item.subtotal)}</td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemFromOrder(editingOrder, setEditingOrder, item.id)}
                              className="text-danger-500 hover:text-danger-700"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Valor Bruto (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-base text-xs font-bold"
                  value={editingOrder.valor}
                  onChange={(e) => setEditingOrder({ ...editingOrder, valor: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Frete (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-base text-xs"
                  value={editingOrder.frete}
                  onChange={(e) => setEditingOrder({ ...editingOrder, frete: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Comissão (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-base text-xs"
                  value={editingOrder.comissao}
                  onChange={(e) => setEditingOrder({ ...editingOrder, comissao: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Desconto (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-base text-xs text-danger-600"
                  value={editingOrder.desconto}
                  onChange={(e) => setEditingOrder({ ...editingOrder, desconto: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="secondary" onClick={() => setEditingOrder(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSaveEditOrder} loading={saving}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Confirmar Exclusão de Pedido" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Tem certeza que deseja remover este pedido permanentemente? Esta ação registrará um evento na auditoria e recalculará os indicadores financeiros do painel.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={deleting}
              onClick={() => deleteConfirmId && handleDeleteOrder(deleteConfirmId)}
            >
              Excluir Definitivamente
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

function OrderBox({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-0.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function FinancialRow({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-slate-800 dark:text-slate-100 ${bold ? 'text-sm sm:text-base font-bold' : 'font-semibold'}`}>
        {value}
      </span>
    </div>
  );
}
