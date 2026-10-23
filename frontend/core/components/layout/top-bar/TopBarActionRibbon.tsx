import React from 'react';
import { RefreshCw } from '../../../../common/components/icons/RefreshCw';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import { RotateCw } from '../../../../common/components/icons/RotateCw';
import { FolderCog } from '../../../../common/components/icons/FolderCog';
import { useGitStore } from '../../../../features/git/store/useGitStore';
import { useVirtualMrStore } from '../../../../features/virtual-mr/store/useVirtualMrStore';
import { TopBarPullButton } from './TopBarPullButton';
import { TopBarMergeButton } from './TopBarMergeButton';
import { TopBarRebaseButton } from './TopBarRebaseButton';

export const TopBarActionRibbon: React.FC<{
  shortcut: (value: string) => string;
}> = ({ shortcut }) => {
  const { openRepoSettings } = useVirtualMrStore();
  const {
    currentRepo,
    isSyncing,
    refreshDiff,
    runSync,
    setIsGitGraphOpen,
  } = useGitStore();

  if (!currentRepo) {
    return (
      <div className="text-xs text-subtext0 italic">
        Select or open a repository to start virtual 3-dot branch comparison
      </div>
    );
  }

  return (
    <>
      {/* Divider between Repo and Action Ribbon */}
      <div className="h-8 w-px bg-surface0 mx-1.5 shrink-0" />

      {/* SourceTree Action Toolbar */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* FETCH BUTTON */}
        <button
          type="button"
          disabled={isSyncing}
          onClick={() => runSync('fetch')}
          className="h-12 min-w-[58px] px-3 flex flex-col items-center justify-center hover:bg-surface0 text-subtext1 hover:text-text transition-colors disabled:opacity-40 cursor-pointer group rounded-sm"
          title={shortcut('git fetch --all --prune (Ctrl+Shift+F)')}
        >
          <RefreshCw
            className={`w-5 h-5 text-primary shrink-0 transition-colors ${
              isSyncing ? 'animate-spin' : ''
            }`}
          />
          <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
            Fetch
          </span>
        </button>

        {/* PULL SPLIT BUTTON */}
        <TopBarPullButton shortcut={shortcut} />

        {/* MERGE SPLIT BUTTON */}
        <TopBarMergeButton />

        {/* REBASE SPLIT BUTTON */}
        <TopBarRebaseButton shortcut={shortcut} />

        {/* CURRENT BRANCH GRAPH */}
        <button
          type="button"
          onClick={() => setIsGitGraphOpen(true)}
          className="h-12 min-w-[58px] px-1.5 flex flex-col items-center justify-center hover:bg-surface0 text-subtext1 hover:text-text transition-colors cursor-pointer group rounded-sm"
          title="Show Git Graph for the checked-out branch"
        >
          <GitCommit className="w-5 h-5 text-primary shrink-0 transition-colors" />
          <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
            Graph
          </span>
        </button>

        {/* REFRESH BUTTON */}
        <button
          type="button"
          disabled={isSyncing}
          onClick={refreshDiff}
          className="h-12 min-w-[58px] px-3 flex flex-col items-center justify-center hover:bg-surface0 text-subtext1 hover:text-text transition-colors disabled:opacity-40 cursor-pointer group rounded-sm"
          title={shortcut('Refresh MR diff & conflict simulation (Ctrl+R)')}
        >
          <RotateCw className="w-5 h-5 text-primary shrink-0 transition-colors" />
          <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
            Refresh
          </span>
        </button>

        {/* REPO SETTINGS BUTTON */}
        <button
          type="button"
          disabled={!currentRepo}
          onClick={() => openRepoSettings('remotes')}
          className="h-12 min-w-[68px] px-2.5 flex flex-col items-center justify-center hover:bg-surface0 text-subtext1 hover:text-text transition-colors disabled:opacity-40 cursor-pointer group rounded-sm"
          title={shortcut('Repository Settings (Ctrl+Alt+S)')}
        >
          <FolderCog className="w-5 h-5 text-primary shrink-0 transition-colors" />
          <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors whitespace-nowrap">
            Repo Settings
          </span>
        </button>
      </div>
    </>
  );
};

