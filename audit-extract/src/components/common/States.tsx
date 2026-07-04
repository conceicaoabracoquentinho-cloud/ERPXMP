import React from 'react';
import { Loader as Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Carregando dados...' }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-brand-600 dark:text-brand-400" />
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

export const ErrorState: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="alert">
      <p className="text-sm font-bold text-danger-600 dark:text-danger-400">Falha ao carregar as informações</p>
      <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-2 text-xs">
          Tentar novamente
        </button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
      {description && <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
};
