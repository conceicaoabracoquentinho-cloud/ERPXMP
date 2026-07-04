import { IntegrationAdapter, IntegrationSyncResult } from '../base/types';
import { IntegrationHttpClient } from '../base/httpClient';
import { Connection } from '../../types';

export const MercadoLivreAdapter: IntegrationAdapter = {
  id: 'mercadolivre',
  name: 'Mercado Livre',
  fornecedor: 'Mercado Livre API',
  type: 'marketplace',

  async testConnection(conn: Partial<Connection>) {
    const targetUrl = conn.url || 'https://api.mercadolibre.com';
    const res = await IntegrationHttpClient.request(targetUrl, { timeoutMs: 10000, retries: 1 });
    if (res.ok) {
      return { ok: true, latencyMs: res.latencyMs, message: 'Conexão estabelecida com Mercado Livre API.' };
    }
    return { ok: false, latencyMs: res.latencyMs, message: `Falha: ${res.error || 'endpoint inacessível'}` };
  },

  async sync(conn: Connection): Promise<IntegrationSyncResult> {
    const startTime = performance.now();
    const headers: Record<string, string> = {};
    if (conn.token_sec) headers['Authorization'] = `Bearer ${conn.token_sec}`;

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

    const records = Array.isArray(res.data) ? res.data : res.data?.results || res.data?.data || [];
    const count = Array.isArray(records) ? records.length : 0;
    return {
      success: true,
      registrosRecebidos: count,
      registrosAlterados: count,
      erros: 0,
      duracaoMs: duration,
      mensagem: `Sincronização com ${conn.nome} concluída: ${count} registros recebidos.`,
    };
  },
};
