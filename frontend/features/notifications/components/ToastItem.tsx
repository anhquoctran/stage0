import React, { useEffect } from 'react';
import { AppLogo } from '../../../common/components/AppLogo';
import { notificationService } from '../services/notificationService';
import { type AppNotification } from '../types/AppNotification';
import type { ToastItemProps } from '../types/ToastItemProps';
import { dismissesManually } from '../utils/dismissesManually';

export const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const dismissPolicy = toast.dismissPolicy || 'both';
  const primaryAction = toast.clickAction || toast.actions?.[0];
  const additionalActions = toast.actions?.filter((action, index) => {
    if (!toast.clickAction && index === 0) return false;
    return !toast.clickAction || action.actionType !== toast.clickAction.actionType || action.payload !== toast.clickAction.payload;
  }) || [];

  useEffect(() => {
    if (dismissPolicy === 'manual' || !toast.autoDismissMs || toast.autoDismissMs <= 0) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [dismissPolicy, toast.id, toast.autoDismissMs, onDismiss]);

  const invokeAction = (action: NonNullable<AppNotification['clickAction']>) => {
    void notificationService.dispatchAction(action, toast.id);
    if (dismissesManually(dismissPolicy)) onDismiss(toast.id);
  };

  return (
    <div
      role="status"
      aria-label={`${toast.title}${toast.body ? `. ${toast.body}` : ''}`}
      className="pointer-events-auto flex w-full max-w-[calc(100vw-32px)] items-center gap-3 rounded-lg border border-[var(--ctp-surface2)] bg-[var(--ctp-base)] px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.28)] sm:px-5 sm:py-4"
      style={{ color: 'var(--ctp-text)' }}
    >
      <AppLogo size="sm" />

      <div className="min-w-0 flex-1">
        <h2 className="min-w-0 truncate whitespace-nowrap text-sm font-medium leading-snug text-[var(--ctp-text)] sm:text-base">
          {toast.title}
        </h2>
        <p className="mt-1 flex min-w-0 items-baseline gap-1.5 overflow-hidden whitespace-nowrap text-xs leading-snug text-[var(--ctp-subtext1)] sm:text-sm">
          <span className="shrink-0 font-medium text-[var(--ctp-subtext0)]">stage0</span>
          <span aria-hidden="true" className="shrink-0 text-[var(--ctp-subtext0)]">•</span>
          <span className="min-w-0 flex-1 truncate" title={toast.body || 'Notification'}>
            {toast.body || 'Notification'}
          </span>
        </p>

        {additionalActions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {additionalActions.map((action, index) => (
              <button
                key={`${action.actionType}-${index}`}
                type="button"
                onClick={() => invokeAction(action)}
                className="rounded-md border border-[var(--ctp-surface1)] bg-[var(--ctp-mantle)] px-2.5 py-1 text-xs font-medium text-[var(--ctp-text)] transition-colors hover:bg-[var(--ctp-surface0)] sm:text-sm"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-1 flex w-14 shrink-0 flex-col items-stretch gap-0.5">
        {primaryAction && (
          <button
            type="button"
            onClick={() => invokeAction(primaryAction)}
            className="rounded-md bg-[var(--ctp-surface1)] px-1.5 py-1 text-xs font-medium text-[var(--ctp-text)] transition-colors hover:bg-[var(--ctp-surface2)]"
            title={primaryAction.label}
          >
            {toast.clickAction ? 'View' : primaryAction.label}
          </button>
        )}
        {dismissesManually(dismissPolicy) && (
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[var(--ctp-subtext1)] transition-colors hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)]"
            aria-label="Dismiss notification"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};
