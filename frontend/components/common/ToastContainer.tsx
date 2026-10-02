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

  const getLevelDetails = () => {
    switch (toast.level) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
          borderColor: 'border-emerald-500/40',
          badgeBg: 'bg-emerald-950/20',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
          borderColor: 'border-amber-500/40',
          badgeBg: 'bg-amber-950/20',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
          borderColor: 'border-red-500/40',
          badgeBg: 'bg-red-950/20',
        };
      case 'update':
        return {
          icon: <Sparkles className="w-4 h-4 text-[#89b4fa] shrink-0 mt-0.5" />,
          borderColor: 'border-[#89b4fa]/50',
          badgeBg: 'bg-[#181825]',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-4 h-4 text-[#89b4fa] shrink-0 mt-0.5" />,
          borderColor: 'border-[#313244]',
          badgeBg: 'bg-[#181825]',
        };
    }
  };

  const { icon, borderColor, badgeBg } = getLevelDetails();

  return (
    <div
      role="alert"
      className={`pointer-events-auto w-84 bg-[#181825] border ${borderColor} ${badgeBg} rounded-lg shadow-2xl p-3 flex items-start gap-2.5 transition-all animate-in slide-in-from-bottom-2 duration-200`}
    >
      {icon}

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
                className="px-2.5 py-1 text-[10px] font-semibold rounded bg-[#313244]/80 hover:bg-[#89b4fa] text-text hover:text-[#11111b] border border-[#45475a]/50 transition-colors cursor-pointer"
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
