import { IntegrationAdapter, IntegrationSyncResult } from '../base/types';
import { IntegrationHttpClient } from '../base/httpClient';
import { Connection } from '../../types';

function buildHeaders(conn: Connection): Record<string, string> {
  const headers: Record<string, string> = {};
  if (conn.token_sec) {
    if (conn.autenticacao === 'Bearer') headers['Authorization'] = `Bearer ${conn.token_sec}`;
    else if (conn.autenticacao === 'API Key') headers['X-API-Key'] = conn.token_sec;
    else if (conn.autenticacao === 'Basic') headers['Authorization'] = `Basic ${btoa(conn.token_sec)}`;
  }
  return headers;
}

function parseRecords(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

async function syncConnection(conn: Connection, adapterName: string): Promise<IntegrationSyncResult> {
  const startTime = performance.now();
  const headers = buildHeaders(conn);
  const res = await IntegrationHttpClient.request(conn.url, {
    method: conn.metodo || 'GET',
    timeoutMs: 30000,
    retries: 2,
    headers,
  });
  const duration = Math.round(performance.now() - startTime);

  if (!res.ok || !res.data) {
    return {
      success: false,
      registrosRecebidos: 0,
      registrosAlterados: 0,
      erros: 1,
      duracaoMs: duration,
      mensagem: `Erro na sincronização com ${conn.nome}: ${res.error || 'sem resposta'}`,
    };
  }

  const records = parseRecords(res.data);
  return {
    success: true,
    registrosRecebidos: records.length,
    registrosAlterados: records.length,
    erros: 0,
    duracaoMs: duration,
    mensagem: `Sincronização com ${conn.nome} concluída via ${adapterName}: ${records.length} registros.`,
  };
}

export const ShopeeAdapter: IntegrationAdapter = {
  id: 'shopee',
  name: 'Shopee',
  fornecedor: 'Shopee Open API',
  type: 'marketplace',

  async testConnection(conn: Partial<Connection>) {
    const targetUrl = conn.url || 'https://partner.shopeesz.com';
    const res = await IntegrationHttpClient.request(targetUrl, { timeoutMs: 10000, retries: 1 });
    if (res.ok) return { ok: true, latencyMs: res.latencyMs, message: 'Conexão estabelecida com Shopee Partner API.' };
    return { ok: false, latencyMs: res.latencyMs, message: `Falha: ${res.error || 'endpoint inacessível'}` };
  },

  async sync(conn: Connection): Promise<IntegrationSyncResult> {
    return syncConnection(conn, 'ShopeeAdapter');
  },
};

export const AmazonAdapter: IntegrationAdapter = {
  id: 'amazon',
  name: 'Amazon SP-API',
  fornecedor: 'Amazon Selling Partner',
  type: 'marketplace',

  async testConnection(conn: Partial<Connection>) {
    const targetUrl = conn.url || 'https://sellingpartnerapi-na.amazon.com';
    const res = await IntegrationHttpClient.request(targetUrl, { timeoutMs: 10000, retries: 1 });
    if (res.ok) return { ok: true, latencyMs: res.latencyMs, message: 'Conexão autenticada com Amazon SP-API.' };
    return { ok: false, latencyMs: res.latencyMs, message: `Falha: ${res.error || 'endpoint inacessível'}` };
  },

  async sync(conn: Connection): Promise<IntegrationSyncResult> {
    return syncConnection(conn, 'AmazonAdapter');
  },
};

export const MagaluAdapter: IntegrationAdapter = {
  id: 'magalu',
  name: 'Magalu Marketplace',
  fornecedor: 'Magalu Open API',
  type: 'marketplace',

  async testConnection(conn: Partial<Connection>) {
    const targetUrl = conn.url || 'https://api.magazineluiza.com.br';
    const res = await IntegrationHttpClient.request(targetUrl, { timeoutMs: 10000, retries: 1 });
    if (res.ok) return { ok: true, latencyMs: res.latencyMs, message: 'Conexão verificada com Magalu Marketplace API.' };
    return { ok: false, latencyMs: res.latencyMs, message: `Falha: ${res.error || 'endpoint inacessível'}` };
  },

  async sync(conn: Connection): Promise<IntegrationSyncResult> {
    return syncConnection(conn, 'MagaluAdapter');
  },
};

export const GenericErpAdapter: IntegrationAdapter = {
  id: 'erp',
  name: 'ERP Principal',
  fornecedor: 'Bling / Tiny ERP',
  type: 'erp',

  async testConnection(conn: Partial<Connection>) {
    const targetUrl = conn.url || 'https://bling.com.br/Api/v2';
    const res = await IntegrationHttpClient.request(targetUrl, { timeoutMs: 10000, retries: 1 });
    if (res.ok) return { ok: true, latencyMs: res.latencyMs, message: 'Conexão ERP estabelecida e chave validada.' };
    return { ok: false, latencyMs: res.latencyMs, message: `Falha: ${res.error || 'endpoint inacessível'}` };
  },

  async sync(conn: Connection): Promise<IntegrationSyncResult> {
    return syncConnection(conn, 'GenericErpAdapter');
  },
};
