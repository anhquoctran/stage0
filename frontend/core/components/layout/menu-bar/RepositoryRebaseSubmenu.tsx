import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import { Play } from '../../../../common/components/icons/Play';
import { SkipForward } from '../../../../common/components/icons/SkipForward';
import { Undo2 } from '../../../../common/components/icons/Undo2';
import type { RepositoryRebaseSubmenuProps } from './RepositoryRebaseSubmenuProps';

export function RepositoryRebaseSubmenu({
  setActiveSubmenu,
  activeSubmenu,
  isSyncing,
  runSync,
  onClose,
  shortcut,
  setIsRebaseFromOpen,
  isRebasing,
}: RepositoryRebaseSubmenuProps) {
  return (
    <div
      className="relative"
      onMouseEnter={() => setActiveSubmenu('rebase')}
      onMouseLeave={() => setActiveSubmenu(null)}
    >
      <button
        type="button"
        onClick={() => setActiveSubmenu('rebase')}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
        aria-haspopup="menu"
        aria-expanded={activeSubmenu === 'rebase'}
      >
        <span className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-subtext0" />
          Rebase
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-subtext0" />
      </button>
      {activeSubmenu === 'rebase' && (
        <div className="absolute left-full top-0 ml-0.5 w-60 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
          <button
            type="button"
            disabled={isSyncing}
            onClick={() => {
              runSync('rebase');
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-subtext0" />
              Rebase
            </span>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Shift+R')}</span>
          </button>
          <button
            type="button"
            disabled={isSyncing}
            onClick={() => {
              onClose();
              setIsRebaseFromOpen(true);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <GitBranch className="w-3.5 h-3.5 text-subtext0" />
              Rebase from...
            </span>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Alt+R')}</span>
          </button>
          <div className="my-1 border-t border-surface0" />
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-subtext0">
            In Progress
          </div>
          <button
            type="button"
            disabled={isSyncing || !isRebasing}
            onClick={() => {
              runSync('rebase_continue');
              onClose();
            }}
            className="w-full flex items-center px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 mr-2 text-subtext0" />
            Continue
          </button>
          <button
            type="button"
            disabled={isSyncing || !isRebasing}
            onClick={() => {
              runSync('rebase_skip');
              onClose();
            }}
            className="w-full flex items-center px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5 mr-2 text-subtext0" />
            Skip Commit
          </button>
          <button
            type="button"
            disabled={isSyncing || !isRebasing}
            onClick={() => {
              runSync('rebase_abort');
              onClose();
            }}
            className="w-full flex items-center px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5 mr-2 text-subtext0" />
            Abort
          </button>
        </div>
      )}
    </div>
  );
}
