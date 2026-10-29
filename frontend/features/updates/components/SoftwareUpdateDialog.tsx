import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { SoftwareUpdatePanel } from './SoftwareUpdatePanel';
import { useSoftwareUpdateStore } from '../store/useSoftwareUpdateStore';

export function SoftwareUpdateDialog() {
  const { t: translateUiText } = useUiTextTranslation();
  const open = useSoftwareUpdateStore((state) => state.panelOpen);
  const close = useSoftwareUpdateStore((state) => state.closePanel);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[var(--backdrop-modal)] p-4 rounded-sm"
      onClick={close} onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key === 'Tab') {
          const elements = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]');
          const first = elements?.[0], last = elements?.[elements.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label="Stage0 software update"
        className="w-full max-w-md max-h-[85vh] overflow-auto bg-base p-5 shadow-2xl rounded-sm" onClick={(event) => event.stopPropagation()}>
        <SoftwareUpdatePanel />
        <button type="button" onClick={close} className="mt-4 border-0 rounded-sm bg-surface0 px-3 py-1.5 text-xs hover:bg-surface1">{translateUiText('common.close')}</button>
      </div>
    </div>
  );
}
