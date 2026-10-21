import React from 'react';
import { GitPullRequest } from '../../../../common/components/icons/GitPullRequest';
import { RefreshCw } from '../../../../common/components/icons/RefreshCw';
import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import { Download } from '../../../../common/components/icons/Download';
import { DownloadCloud } from '../../../../common/components/icons/DownloadCloud';
import { GitMerge } from '../../../../common/components/icons/GitMerge';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import { Play } from '../../../../common/components/icons/Play';
import { SkipForward } from '../../../../common/components/icons/SkipForward';
import { Undo2 } from '../../../../common/components/icons/Undo2';
import { ArrowLeftRight } from '../../../../common/components/icons/ArrowLeftRight';
import { GitCompare } from '../../../../common/components/icons/GitCompare';
import { ExternalLink } from '../../../../common/components/icons/ExternalLink';
import { Terminal } from '../../../../common/components/icons/Terminal';
import { Code2 } from '../../../../common/components/icons/Code2';
import { Folder } from '../../../../common/components/icons/Folder';
import { FolderCog } from '../../../../common/components/icons/FolderCog';
import { useGitStore } from '../../../../features/git/store/useGitStore';
import { useVirtualMrStore } from '../../../../features/virtual-mr/store/useVirtualMrStore';
import {
  openRepoInTerminal,
  openRepoInVsCode,
  openRepoInExplorer,
} from '../../../../features/git/utils/fileActions';

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
        className={`px-2.5 py-1 text-xs font-normal transition-colors ${
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
        <div className="absolute left-0 top-full mt-0.5 w-68 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
          {/* New Virtual MR */}
          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => {
              onClose();
              openNewMrDraft();
            }}
            onMouseEnter={() => setActiveSubmenu(null)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <GitPullRequest className="w-3.5 h-3.5 text-brand group-hover:text-brand transition-colors" />
              <span>New Virtual MR...</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+T')}</span>
          </button>

          <div className="my-1 border-t border-surface0" />

          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('sync')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <button
              type="button"
              onClick={() => setActiveSubmenu('sync')}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
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
              <div className="absolute left-full top-0 ml-0.5 w-60 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => {
                    runSync('fetch');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer"
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
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer"
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
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer"
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

          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('merge')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <button
              type="button"
              onClick={() => setActiveSubmenu('merge')}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
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
              <div className="absolute left-full top-0 ml-0.5 w-60 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
                <button
                  type="button"
                  disabled={isSyncing}
                  onClick={() => {
                    runSync('merge');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer"
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
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left disabled:opacity-40 group cursor-pointer"
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

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => {
              swapBranches();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
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
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <GitCompare className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Refresh Diff &amp; Conflicts</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Ctrl+R')}</span>
          </button>

          <div className="my-1 border-t border-surface0" />

          {/* Open in Submenu Trigger */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('open')}
            onMouseLeave={() => setActiveSubmenu(null)}
          >
            <button
              type="button"
              disabled={!currentRepo}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                <span>Open in</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
            </button>

            {activeSubmenu === 'open' && currentRepo && (
              <div className="absolute left-full top-0 ml-0.5 w-60 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs">
                <button
                  type="button"
                  onClick={async () => {
                    onClose();
                    try {
                      await openRepoInTerminal(currentRepo.local_path);
                      showToast('Opened repository in terminal');
                    } catch (err) {
                      showToast(`Failed to open terminal: ${err}`);
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                    <span>Terminal</span>
                  </div>
                  <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+Shift+T')}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    onClose();
                    try {
                      await openRepoInVsCode(currentRepo.local_path);
                      showToast('Opened repository in VS Code');
                    } catch (err) {
                      showToast(`Failed to open VS Code: ${err}`);
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                    <span>Visual Studio Code</span>
                  </div>
                  <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+Shift+V')}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    onClose();
                    try {
                      await openRepoInExplorer(currentRepo.local_path);
                      showToast(`Opened repository in ${fileManagerName}`);
                    } catch (err) {
                      showToast(`Failed to open ${fileManagerName}: ${err}`);
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
                    <span>{fileManagerName}</span>
                  </div>
                  <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+Shift+E')}</span>
                </button>
              </div>
            )}
          </div>

          <div className="my-1 border-t border-surface0" />

          <button
            type="button"
            disabled={!currentRepo}
            onClick={() => {
              onClose();
              openRepoSettings('remotes');
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer"
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

