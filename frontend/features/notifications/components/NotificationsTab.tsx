import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AlertTriangle } from '../../../common/components/icons/AlertTriangle';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { Sparkles } from '../../../common/components/icons/Sparkles';
import { useNotificationStore } from '../store/useNotificationStore';
import { type NotificationChannel } from '../types/NotificationChannel';
import { ToggleSwitch } from './ToggleSwitch';

const categories: Array<{
  key: NotificationChannel;
  titleKey: string;
  descriptionKey: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: 'aiReview',
    titleKey: 'notifications.aiReviewTitle',
    descriptionKey: 'notifications.aiReviewDescription',
    icon: CheckCircle2,
  },
  {
    key: 'gitSync',
    titleKey: 'notifications.gitSyncTitle',
    descriptionKey: 'notifications.gitSyncDescription',
    icon: RefreshCw,
  },
  {
    key: 'guardrails',
    titleKey: 'notifications.guardrailsTitle',
    descriptionKey: 'notifications.guardrailsDescription',
    icon: AlertTriangle,
  },
];

export const NotificationsTab: React.FC = () => {
  const { t } = useTranslation();
  const appServices = useApplicationServices();
  const { settings, updateChannel } = useNotificationStore();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const canTestNotifications = appServices.platform.capabilities.notifications;

  const handleTestNotification = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      await appServices.notifications.sendTestNotification();
      setTestResult(t('notifications.previewSent'));
    } catch {
      setTestResult(t('notifications.previewFailed'));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-100 select-none pb-6">
      <div>
        <h3 className="border-b border-surface0/50 pb-1 font-mono text-xs font-bold uppercase tracking-tight text-text">
          {t('notifications.categoryHeading')}
        </h3>
        <p className="pt-2 text-[11px] leading-relaxed text-subtext0">
          {t('notifications.categoryDescription')}
        </p>
      </div>

      <div className="flex items-center justify-between gap-5 rounded-sm border border-surface1/70 bg-mantle p-3.5 shadow-xs">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-text">{t('notifications.previewTitle')}</h4>
          <p className="mt-1 text-[11px] leading-relaxed text-subtext0">
            {t('notifications.previewDescription')}
          </p>
          {testResult && (
            <p role="status" className="mt-1.5 text-[11px] text-subtext1" aria-live="polite">
              {testResult}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleTestNotification()}
          disabled={!canTestNotifications || isTesting}
          title={t(canTestNotifications ? 'notifications.testTooltip' : 'notifications.desktopOnly')}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm bg-brand px-3 text-xs font-semibold text-on-accent shadow-xs transition-[filter,opacity] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className={`h-3.5 w-3.5 ${isTesting ? 'animate-pulse' : ''}`} />
          {isTesting ? t('notifications.sending') : t('notifications.testButton')}
        </button>
      </div>

      <div>
        {categories.map(({ key, titleKey, descriptionKey, icon: Icon }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-6 border-b border-surface0/40 py-3 rounded-sm"
          >
            <div className="min-w-0 flex-1 pe-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-text">
                <Icon className="h-3.5 w-3.5 text-subtext0" />
                <span>{t(titleKey)}</span>
              </div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-subtext0">{t(descriptionKey)}</div>
            </div>
            <ToggleSwitch
              checked={settings.channels[key]}
              onChange={(enabled) => updateChannel(key, enabled)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
