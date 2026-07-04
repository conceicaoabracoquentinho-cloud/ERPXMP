import { apiService } from './apiService';
import { getIntegrationAdapter } from '../integrations/registry';
import { Connection, GlobalSyncReport, SyncReportItem } from '../types';
import { supabase } from '../config/supabase';
// Audit identity is passed through the sync flow from pages
let _auditUser = 'Sistema';
let _auditIp: string | null = null;
let _auditUA = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export function setSyncAuditContext(user: string, ip: string | null, ua: string) { _auditUser = user; _auditIp = ip; _auditUA = ua; }

export interface SyncProgressUpdate {
  activeConnectionIndex: number;
  totalConnections: number;
  activeConnectionName: string;
  percent: number;
  elapsedTimeMs: number;
  logs: string[];
  itemReports: SyncReportItem[];
}

export class SyncService {
  /**
   * Syncs a single connection
   */
  static async syncSingle(connection: Connection): Promise<SyncReportItem> {
    const startTime = performance.now();
    const adapter = getIntegrationAdapter(connection.fornecedor || connection.tipo);

    // Update connection status to sincronizando
    await apiService.updateConnection(connection.id, {
      status: 'sincronizando',
    });

    try {
      const result = await adapter.sync(connection);
      const durationMs = Math.round(performance.now() - startTime);

      const updatedTime = new Date().toISOString();
      await apiService.updateConnection(connection.id, {
        status: result.success ? 'online' : 'erro',
        ultima_sincronizacao: updatedTime,
        tempo_resposta_ms: durationMs,
      });

      // Record in sync history
      await apiService.addSyncHistory({
        conexao_id: connection.id,
        conexao_nome: connection.nome,
        inicio: new Date(Date.now() - durationMs).toISOString(),
        fim: updatedTime,
        duracao_ms: durationMs,
        registros_recebidos: result.registrosRecebidos,
        registros_alterados: result.registrosAlterados,
        erros: result.erros,
        status: result.success ? 'concluido' : 'erro',
        detalhes: result.mensagem,
      });

      // Record audit entry
      await apiService.insertAudit({
        usuario: _auditUser,
        acao: 'sincronizacao_individual',
        modulo: 'Integrações',
        registro: connection.nome,
        antes: connection.ultima_sincronizacao,
        depois: `Sincronizado: ${result.registrosRecebidos} recebidos, ${result.registrosAlterados} alterados`,
        ip: _auditIp,
        navegador: _auditUA,
      });

      return {
        connectionId: connection.id,
        connectionName: connection.nome,
        status: result.success ? 'sucesso' : 'erro',
        registrosRecebidos: result.registrosRecebidos,
        registrosAlterados: result.registrosAlterados,
        erros: result.erros,
        duracaoMs: durationMs,
        mensagem: result.mensagem,
      };
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - startTime);
      const errMsg = err instanceof Error ? err.message : 'Falha na conexão';

      await apiService.updateConnection(connection.id, { status: 'erro' });

      return {
        connectionId: connection.id,
        connectionName: connection.nome,
        status: 'erro',
        registrosRecebidos: 0,
        registrosAlterados: 0,
        erros: 1,
        duracaoMs: durationMs,
        mensagem: errMsg,
      };
    }
  }

  /**
   * Executes "Sincronizar Tudo" across all active connections with real-time progress callbacks
   */
  static async syncAll(
    onProgress: (update: SyncProgressUpdate) => void
  ): Promise<GlobalSyncReport> {
    const globalStartTime = performance.now();
    const startTimeIso = new Date().toISOString();

    const connections = await apiService.getConnections();
    const activeConnections = connections.filter((c) => c.ativo);
    const total = activeConnections.length;

    const itemReports: SyncReportItem[] = [];
    const logs: string[] = [`Iniciando Sincronização Geral para ${total} integrações ativas...`];

    onProgress({
      activeConnectionIndex: 0,
      totalConnections: total,
      activeConnectionName: 'Preparando conectores...',
      percent: 0,
      elapsedTimeMs: 0,
      logs: [...logs],
      itemReports: [],
    });

    for (let i = 0; i < total; i++) {
      const conn = activeConnections[i];
      const percent = Math.round(((i) / total) * 100);
      const elapsed = Math.round(performance.now() - globalStartTime);

      logs.push(`Sincronizando: ${conn.nome} (${conn.fornecedor})...`);

      onProgress({
        activeConnectionIndex: i + 1,
        totalConnections: total,
        activeConnectionName: conn.nome,
        percent,
        elapsedTimeMs: elapsed,
        logs: [...logs],
        itemReports: [...itemReports],
      });

      const reportItem = await this.syncSingle(conn);
      itemReports.push(reportItem);

      if (reportItem.status === 'sucesso') {
        logs.push(`✓ ${conn.nome}: ${reportItem.registrosRecebidos} lidos, ${reportItem.registrosAlterados} atualizados em ${reportItem.duracaoMs}ms.`);
      } else {
        logs.push(`✗ ${conn.nome}: Erro — ${reportItem.mensagem}`);
      }

      onProgress({
        activeConnectionIndex: i + 1,
        totalConnections: total,
        activeConnectionName: conn.nome,
        percent: Math.round(((i + 1) / total) * 100),
        elapsedTimeMs: Math.round(performance.now() - globalStartTime),
        logs: [...logs],
        itemReports: [...itemReports],
      });
    }

    const totalDuration = Math.round(performance.now() - globalStartTime);
    const endTimeIso = new Date().toISOString();
    const sucessos = itemReports.filter((r) => r.status === 'sucesso').length;
    const falhas = itemReports.filter((r) => r.status === 'erro').length;

    logs.push(`Sincronização geral concluída em ${totalDuration}ms. Sucessos: ${sucessos}, Falhas: ${falhas}.`);

    // Record audit entry for global sync
    await apiService.insertAudit({
      usuario: _auditUser,
      acao: 'sincronizar_tudo',
      modulo: 'Integrações',
      registro: 'Global Sync',
      antes: `${total} integrações`,
      depois: `${sucessos} sucessos, ${falhas} falhas em ${totalDuration}ms`,
      ip: _auditIp,
      navegador: _auditUA,
    });

    return {
      totalConexoes: total,
      sucessos,
      falhas,
      duracaoTotalMs: totalDuration,
      inicio: startTimeIso,
      fim: endTimeIso,
      itens: itemReports,
    };
  }
}
