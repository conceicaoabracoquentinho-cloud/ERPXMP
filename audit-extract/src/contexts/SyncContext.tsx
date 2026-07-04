import React, { createContext, useContext, useState, useCallback } from 'react';
import { SyncService, SyncProgressUpdate } from '../services/syncService';
import { GlobalSyncReport } from '../types';
import { useToast } from './ToastContext';

interface SyncContextType {
  isSyncingAll: boolean;
  syncProgress: SyncProgressUpdate | null;
  lastSyncReport: GlobalSyncReport | null;
  isReportModalOpen: boolean;
  refreshTrigger: number;
  triggerSyncAll: () => Promise<void>;
  closeReportModal: () => void;
  notifyDataChanged: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressUpdate | null>(null);
  const [lastSyncReport, setLastSyncReport] = useState<GlobalSyncReport | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const toast = useToast();

  const notifyDataChanged = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const triggerSyncAll = useCallback(async () => {
    if (isSyncingAll) return;

    setIsSyncingAll(true);
    setSyncProgress(null);

    try {
      const report = await SyncService.syncAll((update) => {
        setSyncProgress(update);
      });

      setLastSyncReport(report);
      setIsReportModalOpen(true);
      notifyDataChanged();

      if (report.falhas === 0) {
        toast.success(
          `Sincronização concluída! ${report.sucessos} integrações processadas em ${(report.duracaoTotalMs / 1000).toFixed(1)}s.`
        );
      } else {
        toast.warning(
          `Sincronização concluída com avisos: ${report.sucessos} sucessos e ${report.falhas} falhas.`
        );
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Falha ao executar Sincronização Geral');
    } finally {
      setIsSyncingAll(false);
    }
  }, [isSyncingAll, notifyDataChanged, toast]);

  const closeReportModal = useCallback(() => {
    setIsReportModalOpen(false);
  }, []);

  return (
    <SyncContext.Provider
      value={{
        isSyncingAll,
        syncProgress,
        lastSyncReport,
        isReportModalOpen,
        refreshTrigger,
        triggerSyncAll,
        closeReportModal,
        notifyDataChanged,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = (): SyncContextType => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync deve ser usado dentro de um SyncProvider');
  }
  return context;
};
