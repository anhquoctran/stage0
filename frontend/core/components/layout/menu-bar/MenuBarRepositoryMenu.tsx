import React from 'react';
import { ArrowLeftRight } from '../../../../common/components/icons/ArrowLeftRight';
import { FolderCog } from '../../../../common/components/icons/FolderCog';
import { GitCompare } from '../../../../common/components/icons/GitCompare';
import { GitPullRequest } from '../../../../common/components/icons/GitPullRequest';
import { useGitStore } from '../../../../features/git/store/useGitStore';
import { useVirtualMrStore } from '../../../../features/virtual-mr/store/useVirtualMrStore';
import { RepositoryMergeSubmenu } from './RepositoryMergeSubmenu';
import { RepositoryOpenSubmenu } from './RepositoryOpenSubmenu';
import { RepositoryRebaseSubmenu } from './RepositoryRebaseSubmenu';
import { RepositorySyncSubmenu } from './RepositorySyncSubmenu';

export const MenuBarRepositoryMenu: React.FC<{
  isOpen: boolean;
  onToggle: () => void;
  onHover: () => void;
  onClose: () => void;
  shortcut: (value: string) => string;
  fileManagerName: string;
  activeSubmenu: 'sync' | 'merge' | 'rebase' | 'open' | null;
  setActiveSubmenu: (submenu: 'sync' | 'merge' | 'rebase' | 'open' | null) => void;
}> = ({
  isOpen,
  onToggle,
  onHover,
  onClose,
  shortcut,
  fileManagerName,
  activeSubmenu,
  setActiveSubmenu,
}) => {
  const { openRepoSettings, openNewMrDraft } = useVirtualMrStore();
  const {
    currentRepo,
    runSync,
    isSyncing,
    setIsPullFromOpen,
    setIsMergeFromOpen,
    setIsRebaseFromOpen,
    isRebasing,
    swapBranches,
    refreshDiff,
    showToast,
  } = useGitStore();

  return (
    <div className="relative h-full flex items-center">
      <button
        type="button"
        disabled={!currentRepo}
        onClick={onToggle}
        onMouseEnter={() => currentRepo && onHover()}
        className={`px-2.5 py-1 text-xs font-normal transition-colors rounded-sm ${
          !currentRepo
            ? 'text-subtext0/50 cursor-not-allowed'
            : isOpen
              ? 'bg-surface1 text-text cursor-pointer'
              : 'text-subtext1 hover:text-text hover:bg-surface0 cursor-pointer'
        }`}
      >
        Repository
      </button>

      {currentRepo && isOpen && (
        <div className="absolute left-0 top-full mt-0.5 w-68 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs rounded-sm">
          {/* New Virtual MR */}
          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => {
              onClose();
              openNewMrDraft();
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <GitPullRequest className="w-3.5 h-3.5 text-brand group-hover:text-brand transition-colors" />
              <span>New Virtual MR...</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+T')}</span>
          </button>

          <div className="my-1 border-t border-surface0" />

          <RepositorySyncSubmenu
            setActiveSubmenu={setActiveSubmenu}
            activeSubmenu={activeSubmenu}
            isSyncing={isSyncing}
            runSync={runSync}
            onClose={onClose}
            shortcut={shortcut}
            setIsPullFromOpen={setIsPullFromOpen}
          />

          <RepositoryMergeSubmenu
            setActiveSubmenu={setActiveSubmenu}
            activeSubmenu={activeSubmenu}
            isSyncing={isSyncing}
            runSync={runSync}
            onClose={onClose}
            shortcut={shortcut}
            setIsMergeFromOpen={setIsMergeFromOpen}
          />

          <RepositoryRebaseSubmenu
            setActiveSubmenu={setActiveSubmenu}
            activeSubmenu={activeSubmenu}
            isSyncing={isSyncing}
            runSync={runSync}
            onClose={onClose}
            shortcut={shortcut}
            setIsRebaseFromOpen={setIsRebaseFromOpen}
            isRebasing={isRebasing}
          />

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => {
              swapBranches();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Swap Base &amp; Compare</span>
            </div>
          </button>

          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => {
              refreshDiff();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <GitCompare className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Refresh Diff &amp; Conflicts</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+R')}</span>
          </button>

          <div className="my-1 border-t border-surface0" />

          {/* Open in Submenu Trigger */}
          <RepositoryOpenSubmenu
            setActiveSubmenu={setActiveSubmenu}
            currentRepo={currentRepo}
            activeSubmenu={activeSubmenu}
            onClose={onClose}
            showToast={showToast}
            shortcut={shortcut}
            fileManagerName={fileManagerName}
          />

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => {
              onClose();
              openRepoSettings('remotes');
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <FolderCog className="w-3.5 h-3.5 text-accent group-hover:text-text transition-colors" />
              <span className="font-medium text-accent">Repository Settings...</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+Alt+S')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
