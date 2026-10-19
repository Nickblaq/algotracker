import type { Toast } from '@/types';
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from '@/components/icons';

interface Props {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`}>
          {toast.tone === 'success' ? (
            <CheckIcon size={15} />
          ) : toast.tone === 'error' ? (
            <AlertIcon size={15} />
          ) : (
            <InfoIcon size={15} />
          )}
          <span>{toast.message}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
