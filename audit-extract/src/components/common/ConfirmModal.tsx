import React from 'react';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';
import { TriangleAlert as AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            variant === 'danger'
              ? 'bg-danger-50 text-danger-600 dark:bg-danger-950'
              : 'bg-brand-50 text-brand-600 dark:bg-brand-950'
          }`}
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="pt-1 text-sm text-slate-600 dark:text-slate-300">{message}</div>
      </div>
    </Modal>
  );
};
