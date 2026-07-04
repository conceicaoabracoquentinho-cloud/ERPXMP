import React from 'react';
import { useSync } from '../../contexts/SyncContext';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { CircleCheck as CheckCircle2, OctagonAlert as AlertOctagon, Loader as Loader2, RefreshCw, Layers, ShieldCheck } from 'lucide-react';
import { formatNumber, formatDurationMs } from '../../utils/formatters';

export const SyncProgressModal: React.FC = () => {
  const {
    isSyncingAll,
    syncProgress,
    lastSyncReport,
    isReportModalOpen,
    closeReportModal,
  } = useSync();

  if (isSyncingAll && syncProgress) {
    return (
      <Modal open={true} onClose={() => {}} title="Sincronização Geral em Andamento" size="lg">
        <div className="space-y-5">
          <div className="rounded-xl border bg-brand-50/50 p-4 dark:bg-brand-950/40">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
                <Loader2 className="h-4 w-4 animate-spin text-brand-600 dark:text-brand-400" />
                {syncProgress.activeConnectionName}
              </span>
              <span className="text-slate-600 dark:text-slate-300">
                {syncProgress.activeConnectionIndex} / {syncProgress.totalConnections} ({syncProgress.percent}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full bg-brand-600 transition-all duration-300 dark:bg-brand-500"
                style={{ width: `${syncProgress.percent}%` }}
              />
            </div>

            <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Tempo decorrido: {formatDurationMs(syncProgress.elapsedTimeMs)}</span>
              <span>Orquestrando adaptadores oficiais...</span>
            </div>
          </div>

          {/* Live Execution Logs */}
          <div className="rounded-xl border bg-slate-900 p-4 text-xs font-mono text-slate-200 shadow-inner">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Console de Sincronização em Tempo Real
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {syncProgress.logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-slate-500">&gt;</span>
                  <span className={log.startsWith('✓') ? 'text-success-400' : log.startsWith('✗') ? 'text-danger-400' : 'text-slate-300'}>
                    {log}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  if (isReportModalOpen && lastSyncReport) {
    return (
      <Modal
        open={isReportModalOpen}
        onClose={closeReportModal}
        title="Relatório da Sincronização Geral"
        size="lg"
        footer={
          <Button variant="primary" onClick={closeReportModal}>
            Concluir e Atualizar
          </Button>
        }
      >
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border bg-slate-50 p-3.5 dark:bg-slate-800/50">
              <p className="text-xs text-slate-500 dark:text-slate-400">Integrações</p>
              <p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">
                {lastSyncReport.totalConexoes}
              </p>
            </div>
            <div className="rounded-xl border bg-success-50 p-3.5 dark:bg-success-950/40">
              <p className="text-xs text-success-700 dark:text-success-300">Sucessos</p>
              <p className="mt-1 text-xl font-bold text-success-700 dark:text-success-300">
                {lastSyncReport.sucessos}
              </p>
            </div>
            <div className="rounded-xl border bg-danger-50 p-3.5 dark:bg-danger-950/40">
              <p className="text-xs text-danger-700 dark:text-danger-300">Falhas</p>
              <p className="mt-1 text-xl font-bold text-danger-700 dark:text-danger-300">
                {lastSyncReport.falhas}
              </p>
            </div>
            <div className="rounded-xl border bg-brand-50 p-3.5 dark:bg-brand-950/40">
              <p className="text-xs text-brand-700 dark:text-brand-300">Tempo Total</p>
              <p className="mt-1 text-xl font-bold text-brand-700 dark:text-brand-300">
                {formatDurationMs(lastSyncReport.duracaoTotalMs)}
              </p>
            </div>
          </div>

          {/* Breakdown Per Integration */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Resultado por Conexão
            </h4>
            <div className="space-y-2">
              {lastSyncReport.itens.map((item) => (
                <div
                  key={item.connectionId}
                  className="flex flex-col gap-2 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        item.status === 'sucesso'
                          ? 'bg-success-50 text-success-600 dark:bg-success-950'
                          : 'bg-danger-50 text-danger-600 dark:bg-danger-950'
                      }`}
                    >
                      {item.status === 'sucesso' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <AlertOctagon className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {item.connectionName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.mensagem}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <p className="font-bold text-slate-700 dark:text-slate-200">
                        {formatNumber(item.registrosRecebidos)}
                      </p>
                      <p className="text-[10px] text-slate-400">Lidos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-600 dark:text-brand-400">
                        {formatNumber(item.registrosAlterados)}
                      </p>
                      <p className="text-[10px] text-slate-400">Alterados</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-700 dark:text-slate-200">
                        {formatDurationMs(item.duracaoMs)}
                      </p>
                      <p className="text-[10px] text-slate-400">Duração</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  return null;
};
