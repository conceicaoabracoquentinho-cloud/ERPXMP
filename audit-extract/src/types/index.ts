export type ConnectionStatus = 'online' | 'sincronizando' | 'erro' | 'pendente' | 'desativado';
export type ConnectionType = 'erp' | 'marketplace' | 'loja' | 'transportadora' | 'pagamento' | 'fiscal';
export type AuthMethod = 'Bearer' | 'OAuth2' | 'API Key' | 'Basic' | 'Nenhuma';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface Connection {
  id: string;
  empresa_id: string;
  nome: string;
  tipo: ConnectionType;
  fornecedor: string;
  url: string;
  metodo: HttpMethod;
  autenticacao: AuthMethod;
  status: ConnectionStatus;
  ultima_sincronizacao: string | null;
  intervalo_min: number;
  registros: number;
  tempo_resposta_ms: number;
  ativo: boolean;
  criado_em?: string;
  token_sec?: string;
}

export type ConciliationStatus = 'conciliado' | 'divergencia_leve' | 'divergencia_critica' | 'ausente';

export interface Product {
  id: string;
  empresa_id: string;
  sku: string;
  ean: string;
  codigo_erp: string;
  titulo: string;
  descricao: string;
  categoria: string;
  marca: string;
  fornecedor: string;
  custo: number;
  preco: number;
  preco_marketplace: number | null;
  preco_promocional: number | null;
  estoque: number;
  estoque_marketplace: number | null;
  reservado: number;
  peso_kg: number;
  largura_cm: number;
  altura_cm: number;
  comprimento_cm: number;
  conciliacao: ConciliationStatus;
  marketplace: string | null;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export type OrderStatus = 'aguardando' | 'pago' | 'faturado' | 'enviado' | 'entregue' | 'cancelado' | 'devolvido';

export interface OrderItem {
  id: string;
  sku: string;
  titulo: string;
  quantidade: number;
  preco_unitario: number;
  desconto_unitario?: number;
  subtotal: number;
}

export interface Order {
  id: string;
  empresa_id: string;
  numero: string;
  codigo_erp?: string;
  marketplace: string;
  cliente: string;
  cliente_documento?: string;
  valor: number;
  frete: number;
  comissao: number;
  desconto: number;
  status: OrderStatus;
  pagamento: string;
  envio: string;
  transportadora: string;
  conciliacao: ConciliationStatus;
  data: string;
  atualizado_em?: string;
  itens_qtd?: number;
  itens?: OrderItem[];
  observacoes?: string;
}

export type FinancialType = 'receita' | 'taxa' | 'comissao' | 'frete' | 'estorno' | 'chargeback';

export interface FinancialEntry {
  id: string;
  empresa_id: string;
  pedido_id: string | null;
  pedido?: string;
  tipo: FinancialType;
  valor: number;
  taxa: number;
  comissao: number;
  margem: number;
  origem: string;
  data: string;
  criado_em?: string;
}

export type AlertSeverity = 'critico' | 'alto' | 'medio' | 'baixo' | 'informativo';
export type AlertStatus = 'detectado' | 'em_analise' | 'em_correcao' | 'resolvido' | 'arquivado';

export interface Alert {
  id: string;
  empresa_id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  severidade: AlertSeverity;
  status: AlertStatus;
  origem: string;
  modulo: string;
  impacto_financeiro: number;
  sugestao: string;
  responsavel?: string | null;
  resolvido_em?: string | null;
  criado_em: string;
}

export interface AuditEntry {
  id: string;
  empresa_id: string;
  usuario: string;
  acao: string;
  modulo: string;
  registro: string;
  antes: string | null;
  depois: string | null;
  ip: string | null;
  navegador: string | null;
  criado_em: string;
}

export interface SyncHistory {
  id: string;
  empresa_id: string;
  conexao_id: string;
  conexao_nome: string;
  inicio: string;
  fim: string;
  duracao_ms: number;
  registros_recebidos: number;
  registros_alterados: number;
  erros: number;
  status: 'concluido' | 'erro' | 'em_andamento';
  detalhes?: string;
}

export interface Company {
  id: string;
  nome: string;
  razao_social: string;
  cnpj: string;
  inscricao_estadual?: string;
  responsavel?: string;
  email?: string;
  telefone?: string;
  plano: string;
  segmento: string;
  moeda: string;
  timezone: string;
  pais: string;
  status: string;
  criado_em?: string;
}

export interface SystemSettings {
  autoResolveThreshold: number;
  maxRetries: number;
  timeoutSeconds: number;
  syncIntervalMinutes: number;
  autoConciliateEnabled: boolean;
  notifyEmail: boolean;
  notifySlack: boolean;
  notifyCriticalAlerts: boolean;
  slackWebhookUrl: string;
  idioma: string;
}

export type UserRole = 'Administrador Principal' | 'Gerente de E-commerce' | 'Operador Financeiro' | 'Auditor Read-Only';
export type UserStatus = 'Ativo' | 'Inativo' | 'Suspenso';

export interface SystemUser {
  id: string;
  nome: string;
  email: string;
  papel: UserRole;
  status: UserStatus;
  ultimo_acesso: string;
}

export interface SyncReportItem {
  connectionId: string;
  connectionName: string;
  status: 'sucesso' | 'erro' | 'pulpado';
  registrosRecebidos: number;
  registrosAlterados: number;
  erros: number;
  duracaoMs: number;
  mensagem: string;
}

export interface GlobalSyncReport {
  totalConexoes: number;
  sucessos: number;
  falhas: number;
  duracaoTotalMs: number;
  inicio: string;
  fim: string;
  itens: SyncReportItem[];
}

export type ExportDatasetId = 'products' | 'orders' | 'finance' | 'alerts' | 'conciliation' | 'audit' | 'connections';
export type ExportFormatId = 'csv' | 'json' | 'xlsx' | 'pdf';

export interface ExportHistoryEntry {
  id: string;
  empresa_id?: string;
  dataset: string; // Display Name, e.g. 'Produtos'
  dataset_id: ExportDatasetId;
  formato: ExportFormatId;
  usuario: string;
  registros: number;
  tamanho_bytes: number;
  tempo_ms: number;
  status: 'sucesso' | 'erro';
  criado_em: string;
  observacao?: string;
}

export interface ExportSchedule {
  id: string;
  empresa_id?: string;
  nome: string;
  dataset_id: ExportDatasetId;
  formato: ExportFormatId;
  frequencia: 'diario' | 'semanal' | 'mensal';
  horario: string; // HH:mm
  email_destino: string;
  ativo: boolean;
  ultima_execucao?: string | null;
  proxima_execucao?: string | null;
  criado_em: string;
}
