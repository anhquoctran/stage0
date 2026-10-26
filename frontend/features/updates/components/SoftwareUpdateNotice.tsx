import { useEffect } from 'react';
import { useSoftwareUpdateStore } from '../store/useSoftwareUpdateStore';
import { SoftwareUpdateDialog } from './SoftwareUpdateDialog';

export function SoftwareUpdateNotice() {
  const status = useSoftwareUpdateStore((state) => state.status);
  const connect = useSoftwareUpdateStore((state) => state.connect);
  const open = useSoftwareUpdateStore((state) => state.openPanel);
  useEffect(() => connect(), [connect]);
  if (status?.phase === 'installing') {
    return <div role="alertdialog" aria-modal="true" aria-label="Installing Stage0 update"
      className="fixed inset-0 z-[250] flex items-center justify-center bg-base text-text">
      <p className="text-sm">Installing the update. Stage0 will restart…</p>
    </div>;
  }
  return <>
    {status && ['available', 'downloading', 'ready'].includes(status.phase) && (
      <button type="button" onClick={open} className="fixed bottom-8 right-4 z-[130] border-0 rounded-sm bg-brand px-3 py-2 text-xs text-on-accent shadow-lg">
        {status.phase === 'ready' ? 'Update ready to install' : status.phase === 'downloading' ? 'Downloading Stage0 update…' : `Stage0 ${status.version} available`}
      </button>
    )}
    <SoftwareUpdateDialog />
  </>;
}
