import React, { createContext, useContext, useState, useCallback } from 'react';
import { CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, OctagonAlert as AlertOctagon, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  notify: (type: ToastType, message: string, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_ICONS = {
  success: CheckCircle2,
  error: AlertOctagon,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_STYLES = {
  success: 'bg-success-600 text-white',
  error: 'bg-danger-600 text-white',
  warning: 'bg-warning-600 text-white',
  info: 'bg-brand-600 text-white',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (type: ToastType, message: string, title?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      setToasts((prev) => [...prev, { id, type, message, title }]);
      setTimeout(() => removeToast(id), 4500);
    },
    [removeToast]
  );

  const success = useCallback((msg: string, title?: string) => notify('success', msg, title), [notify]);
  const error = useCallback((msg: string, title?: string) => notify('error', msg, title), [notify]);
  const warning = useCallback((msg: string, title?: string) => notify('warning', msg, title), [notify]);
  const info = useCallback((msg: string, title?: string) => notify('info', msg, title), [notify]);

  return (
    <ToastContext.Provider value={{ notify, success, error, warning, info }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-[100] flex max-w-md flex-col gap-2.5">
        {toasts.map((toast) => {
          const Icon = TOAST_ICONS[toast.type] ?? Info;
          const style = TOAST_STYLES[toast.type] ?? TOAST_STYLES.info;
          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-card-hover animate-slide-in ${style}`}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="flex-1">
                {toast.title && <p className="font-bold leading-tight">{toast.title}</p>}
                <p className={toast.title ? 'mt-0.5 text-xs opacity-90' : 'text-sm'}>{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="shrink-0 rounded p-1 hover:bg-white/20"
                aria-label="Fechar notificação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider');
  }
  return context;
};
