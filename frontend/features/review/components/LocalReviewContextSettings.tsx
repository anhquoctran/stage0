import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { SettingRow } from '../../preferences/components/SettingRow';
import { ZedSwitch } from '../../preferences/components/ZedSwitch';
import type { LocalContextCacheStatus } from '../types/LocalContextCacheStatus';

export function LocalReviewContextSettings({ enabled, onChange }: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const { t } = useTranslation();
  const services = useApplicationServices();
  const [status, setStatus] = useState<LocalContextCacheStatus | null>(null);
  const sequence = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const next = await services.reviews.getReviewContextCache({});
      if (current === sequence.current) setStatus(next);
    }
    catch { /* Optional cache status must not break Preferences or model setup. */ }
  }, [services]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!busy && !status?.installing) return;
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [busy, status?.installing, refresh]);
  async function act(install: boolean) {
    setBusy(true);
    setError('');
    try {
      const next = await (install
        ? services.reviews.installReviewContextModel({})
        : services.reviews.clearReviewContextCache({}));
      ++sequence.current;
      setStatus(next);
    } catch {
      setError(t(install ? 'review.localContext.installFailed' : 'review.localContext.clearFailed'));
    } finally { setBusy(false); }
  }
  const installing = busy || status?.installing;
  return (
    <div className="space-y-2 rounded-sm">
      <SettingRow title={t('review.localContext.title')} description={t('review.localContext.description')}>
        <ZedSwitch checked={enabled} onChange={onChange} />
      </SettingRow>
      {enabled && (
        <div className="rounded-sm bg-mantle p-3 space-y-2 text-xs text-subtext0">
          <p>{t('review.localContext.modelDescription')}</p>
          <p role="status">{t(status?.modelReady ? 'review.localContext.ready' : 'review.localContext.notInstalled')}</p>
          <div className="flex flex-wrap gap-2 items-center">
              <button type="button" disabled={!!installing} onClick={() => void act(true)}
                className="rounded-sm border-0 bg-primary text-crust px-3 py-1.5 disabled:opacity-50">
                {t(installing ? 'review.localContext.installing' : status?.modelReady ? 'review.localContext.repair' : 'review.localContext.download', {
                  size: Math.ceil((status?.downloadBytes ?? 487724985) / 1024 / 1024),
                })}
              </button>
            <button type="button" disabled={!!installing} onClick={() => void act(false)}
              className="rounded-sm border-0 bg-surface0 text-text px-3 py-1.5 disabled:opacity-50">
              {t('review.localContext.clear')}
            </button>
            {status && <span>{t('review.localContext.size', { size: (status.cacheBytes / 1024 / 1024).toFixed(1) })}</span>}
          </div>
          {error && <p role="alert" className="text-red">{error}</p>}
        </div>
      )}
    </div>
  );
}
