import type { WindowControlAction } from '../../types/WindowControlAction';

export function WindowControlIcon({ action, maximized }: {
  action: WindowControlAction;
  maximized: boolean;
}) {
  if (action === 'minimize') return (
    <svg width="10" height="1" viewBox="0 0 10 1">
      <rect width="10" height="1" fill="currentColor" />
    </svg>
  );
  if (action === 'close') return (
    <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
      <line x1="0" y1="0" x2="10" y2="10" />
      <line x1="10" y1="0" x2="0" y2="10" />
    </svg>
  );
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
      {maximized ? <>
        <path d="M2.5 2.5V0.5H9.5V7.5H7.5" strokeWidth="1" />
        <rect x="0.5" y="2.5" width="7" height="7" strokeWidth="1" />
      </> : <rect x="0.5" y="0.5" width="9" height="9" strokeWidth="1" />}
    </svg>
  );
}
