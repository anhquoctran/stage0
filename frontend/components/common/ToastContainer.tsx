import React, { useEffect } from 'react';
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  X,
} from '@/components/common/icons';
import { useNotificationStore } from '../../store/useNotificationStore';
import { notificationService } from '../../services/notificationService';
import { AppNotification } from '../../types/notification';

interface ToastItemProps {
  toast: AppNotification;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    if (!toast.autoDismissMs || toast.autoDismissMs <= 0) return;

    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.autoDismissMs);

    return () => clearTimeout(timer);
  }, [toast.id, toast.autoDismissMs, onDismiss]);

  const getLevelIcon = () => {
    switch (toast.level) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-subtext0 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-subtext0 shrink-0 mt-0.5" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-subtext0 shrink-0 mt-0.5" />;
      case 'update':
        return <Sparkles className="w-4 h-4 text-subtext0 shrink-0 mt-0.5" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-subtext0 shrink-0 mt-0.5" />;
    }
  };

  return (
    <div
      role="alert"
      className="pointer-events-auto w-84 bg-[#181825] border border-[#313244] rounded shadow-2xl p-3 flex items-start gap-2.5 transition-all animate-in slide-in-from-bottom-2 duration-200"
    >
      {getLevelIcon()}

      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-xs font-bold text-text truncate">{toast.title}</h5>
        </div>
        <p className="text-[11px] text-subtext0 leading-relaxed mt-0.5 whitespace-pre-wrap break-words">
          {toast.body}
        </p>

        {/* Action buttons */}
        {toast.actions && toast.actions.length > 0 && (
          <div className="flex items-center gap-2 mt-2 pt-1 border-t border-[#313244]/50">
            {toast.actions.map((act) => (
              <button
                key={act.label}
                type="button"
                onClick={() => notificationService.handleAction(act, toast.id)}
                className="px-2.5 py-1 text-[10px] font-medium rounded bg-[#313244] hover:bg-[#45475a] text-text border border-[#45475a]/50 transition-colors cursor-pointer"
              >
                {act.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="p-1 rounded text-subtext0 hover:text-text hover:bg-[#313244]/60 transition-colors shrink-0 cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { activeToasts, dismissToast } = useNotificationStore();

  if (activeToasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-10 right-4 z-50 flex flex-col gap-2 pointer-events-none select-none max-w-sm"
    >
      {activeToasts.slice(-5).map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};
