import { Company } from '../types';

export const DEFAULT_COMPANY: Company = {
  id: '00000000-0000-0000-0000-000000000001',
  nome: 'TechCommerce Brasil',
  razao_social: 'TechCommerce Soluções Digitais LTDA',
  cnpj: '12.345.678/0001-90',
  inscricao_estadual: '110.245.980.112',
  responsavel: 'Carlos Eduardo Santos',
  email: 'suporte@techcommerce.com.br',
  telefone: '(11) 3450-9800',
  segmento: 'E-commerce Multicanal',
  plano: 'Enterprise',
  timezone: 'America/Sao_Paulo',
  moeda: 'BRL',
  pais: 'Brasil',
  status: 'Ativo',
};

export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', description: 'Visão executiva geral da operação e KPIs em tempo real', icon: 'LayoutDashboard' },
  { id: 'connections', label: 'Conexões', description: 'Gerenciamento de APIs, integradores e frequências de sincronização', icon: 'Plug' },
  { id: 'conciliation', label: 'Conciliação', description: 'Motor de reconciliação de preços, saldos e pedidos ERP × Marketplaces', icon: 'GitCompareArrows' },
  { id: 'products', label: 'Produtos', description: 'Catálogo unificado de produtos e saldos em multicanais', icon: 'Package' },
  { id: 'orders', label: 'Pedidos', description: 'Gestão de vendas omnichannel e demonstrativo de taxas', icon: 'ShoppingCart' },
  { id: 'finance', label: 'Financeiro', description: 'Lançamentos, receitas líquidas, margens e comissões', icon: 'DollarSign' },
  { id: 'alerts', label: 'Alertas', description: 'Central de ocorrências e recomendações de correção', icon: 'BellRing' },
  { id: 'audit', label: 'Auditoria', description: 'Trilha imutável de eventos e alterações no sistema', icon: 'History' },
  { id: 'exports', label: 'Exportações', description: 'Download de relatórios e agendamento de backups', icon: 'Download' },
  { id: 'settings', label: 'Configurações', description: 'Dados corporativos, preferências e controle de acessos', icon: 'Settings' },
] as const;

export const CONNECTION_TYPE_LABELS: Record<string, string> = {
  erp: 'ERP',
  marketplace: 'Marketplace',
  loja: 'Loja Virtual',
  transportadora: 'Transportadora',
  pagamento: 'Gateway Pagamento',
  fiscal: 'Sistema Fiscal',
};

export const SEVERITY_COLORS = {
  critico: {
    label: 'Crítico',
    color: 'text-danger-700 dark:text-danger-300',
    dot: 'bg-danger-500',
    bg: 'bg-danger-50 dark:bg-danger-950',
  },
  alto: {
    label: 'Alto',
    color: 'text-accent-700 dark:text-accent-300',
    dot: 'bg-accent-500',
    bg: 'bg-accent-50 dark:bg-accent-950',
  },
  medio: {
    label: 'Médio',
    color: 'text-warning-700 dark:text-warning-300',
    dot: 'bg-warning-500',
    bg: 'bg-warning-50 dark:bg-warning-950',
  },
  baixo: {
    label: 'Baixo',
    color: 'text-brand-700 dark:text-brand-300',
    dot: 'bg-brand-500',
    bg: 'bg-brand-50 dark:bg-brand-950',
  },
  informativo: {
    label: 'Informativo',
    color: 'text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
  },
} as const;

export const STATUS_CONNECTION_CONFIG = {
  online: { label: 'Online', color: 'text-success-700 dark:text-success-300', dot: 'bg-success-500' },
  sincronizando: { label: 'Sincronizando', color: 'text-brand-700 dark:text-brand-300', dot: 'bg-brand-500 animate-pulse-soft' },
  erro: { label: 'Erro', color: 'text-danger-700 dark:text-danger-300', dot: 'bg-danger-500' },
  pendente: { label: 'Pendente', color: 'text-warning-700 dark:text-warning-300', dot: 'bg-warning-500' },
  desativado: { label: 'Desativado', color: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-400' },
} as const;

export const CONCILIATION_CONFIG = {
  conciliado: { label: 'Conciliado', color: 'text-success-700 dark:text-success-300', icon: 'CheckCircle2' },
  divergencia_leve: { label: 'Divergência leve', color: 'text-warning-700 dark:text-warning-300', icon: 'AlertTriangle' },
  divergencia_critica: { label: 'Divergência crítica', color: 'text-danger-700 dark:text-danger-300', icon: 'AlertOctagon' },
  ausente: { label: 'Ausente', color: 'text-slate-500 dark:text-slate-400', icon: 'Minus' },
} as const;

export const ORDER_STATUS_CONFIG = {
  aguardando: { label: 'Aguardando', color: 'text-warning-700 dark:text-warning-300' },
  pago: { label: 'Pago', color: 'text-brand-700 dark:text-brand-300' },
  faturado: { label: 'Faturado', color: 'text-accent-700 dark:text-accent-300' },
  enviado: { label: 'Enviado', color: 'text-brand-700 dark:text-brand-300' },
  entregue: { label: 'Entregue', color: 'text-success-700 dark:text-success-300' },
  cancelado: { label: 'Cancelado', color: 'text-danger-700 dark:text-danger-300' },
  devolvido: { label: 'Devolvido', color: 'text-slate-500 dark:text-slate-400' },
} as const;
