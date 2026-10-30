import { useEffect } from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { useSoftwareUpdateStore } from '../store/useSoftwareUpdateStore';
import { SoftwareUpdateDialog } from './SoftwareUpdateDialog';

export function SoftwareUpdateNotice() {
  const { t: translateUiText } = useUiTextTranslation();
  const status = useSoftwareUpdateStore((state) => state.status);
  const connect = useSoftwareUpdateStore((state) => state.connect);
  const open = useSoftwareUpdateStore((state) => state.openPanel);
  useEffect(() => connect(), [connect]);
  if (status?.phase === 'installing') {
    return <div role="alertdialog" aria-modal="true" aria-label={translateUiText('updates.notice.installingLabel')}
      className="fixed inset-0 z-[250] flex items-center justify-center bg-base text-text">
      <p className="text-sm">{translateUiText('updates.notice.installingMessage')}</p>
    </div>;
  }
  return <>
    {status && ['available', 'downloading', 'ready'].includes(status.phase) && (
      <button type="button" onClick={open} className="fixed bottom-8 end-4 z-[130] border-0 rounded-sm bg-brand px-3 py-2 text-xs text-on-accent shadow-lg">
        {translateUiText(status.phase === 'ready'
          ? 'updates.notice.ready'
          : status.phase === 'downloading'
            ? 'updates.notice.downloading'
            : 'updates.notice.available', { version: status.version })}
      </button>
    )}
    <SoftwareUpdateDialog />
  </>;
}
