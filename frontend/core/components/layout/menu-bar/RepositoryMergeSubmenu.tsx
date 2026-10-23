import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import { GitMerge } from '../../../../common/components/icons/GitMerge';
import type { RepositoryMergeSubmenuProps } from './RepositoryMergeSubmenuProps';

export function RepositoryMergeSubmenu({
  setActiveSubmenu,
  activeSubmenu,
  isSyncing,
  runSync,
  onClose,
  shortcut,
  setIsMergeFromOpen,
}: RepositoryMergeSubmenuProps) {
  return (
    <div
      className="relative"
      onMouseEnter={() => setActiveSubmenu('merge')}
      onMouseLeave={() => setActiveSubmenu(null)}
    >
      <button
        type="button"
        onClick={() => setActiveSubmenu('merge')}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
        aria-haspopup="menu"
        aria-expanded={activeSubmenu === 'merge'}
      >
        <span className="flex items-center gap-2">
          <GitMerge className="w-3.5 h-3.5 text-subtext0" />
          Merge
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-subtext0" />
      </button>
      {activeSubmenu === 'merge' && (
        <div className="absolute left-full top-0 ml-0.5 w-60 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs rounded-sm">
          <button
            type="button"
            disabled={isSyncing}
            onClick={() => {
              runSync('merge');
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer rounded-sm"
          >
            <span className="flex items-center gap-2">
              <GitMerge className="w-3.5 h-3.5 text-subtext0" />
              Merge Upstream
            </span>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+M')}</span>
          </button>
          <button
            type="button"
            disabled={isSyncing}
            onClick={() => {
              onClose();
              setIsMergeFromOpen(true);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer rounded-sm"
          >
            <span className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-subtext0" />
              Merge from...
            </span>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Alt+M')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
