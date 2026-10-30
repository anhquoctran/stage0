import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { useSoftwareUpdateStore } from '../store/useSoftwareUpdateStore';
import { useAutomaticUpdatePreference } from '../hooks/useAutomaticUpdatePreference';

export function SoftwareUpdatePanel() {
  const { t } = useTranslation();
  const services = useApplicationServices();
  const { status, pending, error, connect, check, download, install } = useSoftwareUpdateStore();
  const automatic = useAutomaticUpdatePreference();
  const [savedWork, setSavedWork] = useState(false);
  useEffect(() => connect(), [connect]);
  useEffect(() => setSavedWork(false), [status?.version, status?.phase]);
  const busy = pending || ['checking', 'downloading', 'installing'].includes(status?.phase ?? '');
  const desktop = services.platform.capabilities.backend;
  const percent = status?.totalBytes
    ? Math.min(100, Math.floor(status.downloadedBytes / status.totalBytes * 100)) : undefined;
  const openReleases = () => services.externalLinks.openExternalUrl({ url: 'https://github.com/anhquoctran/stage0/releases' });
  return (
    <section aria-label={t('updates.section')} className="space-y-3 text-xs text-text">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">{t('updates.title')}</span>
        <button type="button" className="text-brand hover:underline rounded-sm" onClick={() => void openReleases().catch(() => {})}>
          GitHub Releases
        </button>
      </div>
      <p role="status" aria-live="polite" className="text-subtext0">
        {!desktop ? t('updates.desktopOnly')
          : status?.phase === 'checking' ? t('updates.checking')
          : status?.phase === 'downloading' ? t('updates.downloading', { progress: percent === undefined ? '' : ` — ${percent}%` })
          : status?.phase === 'available' ? t('updates.available', { version: status.version })
          : status?.message ?? t('updates.checkPrompt')}
      </p>
      {status?.phase === 'downloading' && (
        <progress aria-label={t('updates.downloadProgress')} max={100} value={percent} className="w-full accent-brand rounded-sm" />
      )}
      {status?.notes && (
        <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words bg-mantle p-2 font-sans text-subtext0 rounded-sm">{status.notes}</pre>
      )}
      {(error || automatic.error) && <p role="alert" className="text-red">{error || automatic.error}</p>}
      {desktop && status?.supported && (
        <label className="flex items-start gap-2 text-subtext0">
          <input type="checkbox" checked={automatic.enabled} disabled={automatic.saving || busy}
            onChange={(event) => void automatic.change(event.target.checked)} className="accent-brand rounded-sm" />
          {t('updates.automaticCheck')}
        </label>
      )}
      {status?.phase === 'ready' && (
        <label className="flex items-start gap-2 text-subtext0">
          <input type="checkbox" checked={savedWork} onChange={(event) => setSavedWork(event.target.checked)} className="accent-brand rounded-sm" />
          {t('updates.savedWorkConfirmation')}
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!desktop || !status?.supported || busy || status.phase === 'ready'}
          onClick={() => void check()} className="border-0 rounded-sm bg-surface0 px-3 py-1.5 hover:bg-surface1 disabled:opacity-50">
          {t('updates.checkForUpdates')}
        </button>
        {status?.version && ['available', 'error'].includes(status.phase) && (
          <button type="button" disabled={busy} onClick={() => void download()}
            className="border-0 rounded-sm bg-brand px-3 py-1.5 text-on-accent disabled:opacity-50">
            {t('updates.downloadVersion', { version: status.version })}
          </button>
        )}
        {status?.phase === 'ready' && (
          <button type="button" disabled={busy || !savedWork} onClick={() => void install(savedWork)}
            className="border-0 rounded-sm bg-brand px-3 py-1.5 text-on-accent disabled:opacity-50">
            {t('updates.installAndRestart')}
          </button>
        )}
      </div>
    </section>
  );
}
