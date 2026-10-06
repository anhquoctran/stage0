import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { X } from '@/components/common/icons';
import { AppLogo } from './AppLogo';
import { useNotificationStore } from '../../store/useNotificationStore';
import { notificationService } from '../../services/notificationService';
import type { AppNotification, NotificationDismissPolicy } from '../../types/notification';

const MAX_VISIBLE_TOASTS = 5;

interface ToastItemProps {
  toast: AppNotification;
  onDismiss: (id: string) => void;
}

function dismissesManually(policy: NotificationDismissPolicy) {
  return policy === 'manual' || policy === 'both';
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const dismissPolicy = toast.dismissPolicy || 'both';

  useEffect(() => {
    if (dismissPolicy === 'manual' || !toast.autoDismissMs || toast.autoDismissMs <= 0) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [dismissPolicy, toast.id, toast.autoDismissMs, onDismiss]);

  const variant = toast.variant || notificationService.variantForLevel(toast.level);
  const accent = {
    default: 'var(--ctp-brand)',
    success: 'var(--ctp-green)',
    warning: 'var(--ctp-yellow)',
    danger: 'var(--ctp-red)',
  }[variant];

  const invokeAction = (action: NonNullable<AppNotification['clickAction']>) => {
    void notificationService.dispatchAction(action, toast.id);
    if (dismissesManually(dismissPolicy)) onDismiss(toast.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!toast.clickAction || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    invokeAction(toast.clickAction);
  };

  return (
    <div
      role={toast.clickAction ? 'button' : 'status'}
      tabIndex={toast.clickAction ? 0 : undefined}
      onClick={toast.clickAction ? () => invokeAction(toast.clickAction!) : undefined}
      onKeyDown={handleKeyDown}
      className={`pointer-events-auto flex w-[392px] max-w-[calc(100vw-24px)] items-start gap-3 rounded-xl border border-[var(--ctp-surface0)] bg-[var(--ctp-base)] p-3 shadow-2xl ${toast.clickAction ? 'cursor-pointer' : ''}`}
      style={{ borderLeft: `3px solid ${accent}`, color: 'var(--ctp-text)' }}
      aria-label={toast.clickAction ? `${toast.title}. Activate to open.` : toast.title}
    >
      <AppLogo size="sm" className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold">{toast.title}</h2>
        {toast.body && (
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--ctp-subtext1)]">
            {toast.body}
          </p>
        )}

        {toast.actions && toast.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 border-t border-[var(--ctp-surface0)] pt-2">
            {toast.actions.map((action, index) => (
              <button
                key={`${action.actionType}-${index}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void notificationService.dispatchAction(action, toast.id);
                  if (dismissesManually(dismissPolicy)) onDismiss(toast.id);
                }}
                className="rounded-md border border-[var(--ctp-surface1)] bg-[var(--ctp-mantle)] px-2.5 py-1 text-xs font-medium text-[var(--ctp-text)] transition-colors hover:bg-[var(--ctp-surface0)]"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {dismissesManually(dismissPolicy) && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss(toast.id);
          }}
          className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-[var(--ctp-subtext0)] transition-colors hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

interface ToastContainerProps {
  position: 'top-right' | 'bottom-right';
  onHeightChange?: (height: number) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ position, onHeightChange }) => {
  const { activeToasts, dismissToast } = useNotificationStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleToasts = activeToasts.slice(0, MAX_VISIBLE_TOASTS);

  useLayoutEffect(() => {
    if (visibleToasts.length === 0) return;
    const element = containerRef.current;
    if (!element || !onHeightChange) return;

    const reportSize = () => onHeightChange(Math.ceil(element.getBoundingClientRect().height));
    reportSize();
    const observer = new ResizeObserver(reportSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [visibleToasts.length, onHeightChange]);

  if (visibleToasts.length === 0) return null;

  const placement = position === 'top-right' ? 'top-3' : 'bottom-3';
  const stacking = position === 'top-right' ? 'flex-col' : 'flex-col-reverse';

  return (
    <div
      ref={containerRef}
      aria-live="polite"
      className={`pointer-events-none absolute right-0 ${placement} flex ${stacking} w-[420px] max-w-screen gap-2 overflow-y-auto px-3 py-3 select-none`}
      style={{ maxHeight: '100vh' }}
    >
      {visibleToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
};
