import { useTranslation } from 'react-i18next';
import { useNotificationPermission } from '../hooks/useNotificationPermission';

/** Shared by onboarding and Preferences; denial never blocks app setup. */
export function NotificationPermissionPanel() {
  const { t } = useTranslation();
  const { permission, busy, error, request, openSettings } = useNotificationPermission();
  return <section className="space-y-2 rounded-sm border border-surface0 bg-mantle p-3.5">
    <h3 className="text-xs font-semibold text-text">{t('notifications.permission.title')}</h3>
    <p className="text-[11px] leading-relaxed text-subtext0">{t('notifications.permission.description')}</p>
    {(!error || permission) && <p role="status" className="text-[11px] text-subtext1" aria-live="polite">
      {t(permission ? `notifications.permission.${permission}` : 'common.loading')}
    </p>}
    {error && <p role="alert" className="text-xs text-red">{t('notifications.permission.error')}</p>}
    <div className="flex flex-wrap gap-2">
      {permission === 'prompt' && <button type="button" onClick={() => void request()} disabled={busy}
        className="border-0 rounded-sm bg-brand px-3 py-1.5 text-xs text-on-accent disabled:opacity-50">
        {t(busy ? 'common.loading' : 'notifications.permission.request')}
      </button>}
      {permission !== null && permission !== 'unsupported' && <button type="button" onClick={() => void openSettings()} disabled={busy}
        className="rounded-sm border border-surface0 bg-base px-3 py-1.5 text-xs text-text disabled:opacity-50">
        {t('notifications.permission.settings')}
      </button>}
      {error && <button type="button" onClick={() => void request()} disabled={busy}
        className="rounded-sm border border-surface0 bg-base px-3 py-1.5 text-xs text-text">{t('common.errorBoundary.tryAgain')}</button>}
    </div>
  </section>;
}
