import { IntegrationAdapter } from './base/types';
import { MercadoLivreAdapter } from './adapters/mercadolivre';
import { ShopeeAdapter, AmazonAdapter, MagaluAdapter, GenericErpAdapter } from './adapters/otherAdapters';

const ADAPTER_REGISTRY: Record<string, IntegrationAdapter> = {
  mercadolivre: MercadoLivreAdapter,
  shopee: ShopeeAdapter,
  amazon: AmazonAdapter,
  magalu: MagaluAdapter,
  erp: GenericErpAdapter,
};

export function getIntegrationAdapter(fornecedorOrType: string): IntegrationAdapter {
  const normalizedKey = fornecedorOrType.toLowerCase().replace(/[^a-z]/g, '');
  for (const [key, adapter] of Object.entries(ADAPTER_REGISTRY)) {
    if (normalizedKey.includes(key) || adapter.fornecedor.toLowerCase().includes(normalizedKey)) {
      return adapter;
    }
  }
  // Default fallback adapter
  return GenericErpAdapter;
}
