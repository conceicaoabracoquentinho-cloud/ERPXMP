import { Connection, Product, Order, FinancialEntry } from '../../types';

export interface IntegrationSyncResult {
  success: boolean;
  registrosRecebidos: number;
  registrosAlterados: number;
  erros: number;
  duracaoMs: number;
  mensagem: string;
  detalhes?: {
    produtosAtualizados?: Partial<Product>[];
    pedidosAtualizados?: Partial<Order>[];
    financeiroAtualizado?: Partial<FinancialEntry>[];
  };
}

export interface IntegrationAdapter {
  id: string;
  name: string;
  fornecedor: string;
  type: Connection['tipo'];
  sync(connection: Connection): Promise<IntegrationSyncResult>;
  testConnection(connection: Partial<Connection>): Promise<{ ok: boolean; latencyMs: number; message: string }>;
}
