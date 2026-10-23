import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import { Download } from '../../../../common/components/icons/Download';
import { DownloadCloud } from '../../../../common/components/icons/DownloadCloud';
import { RefreshCw } from '../../../../common/components/icons/RefreshCw';
import type { RepositorySyncSubmenuProps } from './RepositorySyncSubmenuProps';

export function RepositorySyncSubmenu({
  setActiveSubmenu,
  activeSubmenu,
  isSyncing,
  runSync,
  onClose,
  shortcut,
  setIsPullFromOpen,
}: RepositorySyncSubmenuProps) {
  return (
    <div
      className="relative"
      onMouseEnter={() => setActiveSubmenu('sync')}
      onMouseLeave={() => setActiveSubmenu(null)}
    >
      <button
        type="button"
        onClick={() => setActiveSubmenu('sync')}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
        aria-haspopup="menu"
        aria-expanded={activeSubmenu === 'sync'}
      >
        <span className="flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-subtext0" />
          Synchronize
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-subtext0" />
      </button>
      {activeSubmenu === 'sync' && (
        <div className="absolute left-full top-0 ml-0.5 w-60 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs rounded-sm">
          <button
            type="button"
            disabled={isSyncing}
            onClick={() => {
              runSync('fetch');
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer rounded-sm"
          >
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-subtext0" />
              Fetch (All &amp; Prune)
            </span>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+F')}</span>
          </button>
          <button
            type="button"
            disabled={isSyncing}
            onClick={() => {
              runSync('pull');
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer rounded-sm"
          >
            <span className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-subtext0" />
              Pull
            </span>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+P')}</span>
          </button>
          <button
            type="button"
            disabled={isSyncing}
            onClick={() => {
              onClose();
              setIsPullFromOpen(true);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer rounded-sm"
          >
            <span className="flex items-center gap-2">
              <DownloadCloud className="w-3.5 h-3.5 text-subtext0" />
              Pull from...
            </span>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Alt+P')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
