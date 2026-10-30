import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from '../../../../common/components/icons/RefreshCw';
import { GitCommit } from '../../../../common/components/icons/GitCommit';
import { RotateCw } from '../../../../common/components/icons/RotateCw';
import { Cog } from '../../../../common/components/icons/Cog';
import { useGitStore } from '../../../../features/git/store/useGitStore';
import { useVirtualMrStore } from '../../../../features/virtual-mr/store/useVirtualMrStore';
import { TopBarPullButton } from './TopBarPullButton';
import { TopBarMergeButton } from './TopBarMergeButton';
import { TopBarRebaseButton } from './TopBarRebaseButton';
import { useCommandShortcut } from '../../../hooks/useCommandShortcut';

export const TopBarActionRibbon: React.FC = () => {
  const { t } = useTranslation();
  const { title } = useCommandShortcut();
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
        {t('common.layout.selectRepositoryForComparison')}
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
          title={title('fetch', 'git fetch --all --prune')}
        >
          <RefreshCw
            className={`w-5 h-5 text-primary shrink-0 transition-colors ${
              isSyncing ? 'animate-spin' : ''
            }`}
          />
          <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
            {t('common.layout.fetch')}
          </span>
        </button>

        {/* PULL SPLIT BUTTON */}
        <TopBarPullButton />

        {/* MERGE SPLIT BUTTON */}
        <TopBarMergeButton />

        {/* REBASE SPLIT BUTTON */}
        <TopBarRebaseButton />

        {/* CURRENT BRANCH GRAPH */}
        <button
          type="button"
          onClick={() => setIsGitGraphOpen(true)}
          className="h-12 min-w-[58px] px-1.5 flex flex-col items-center justify-center hover:bg-surface0 text-subtext1 hover:text-text transition-colors cursor-pointer group rounded-sm"
          title={t('common.layout.showGitGraph')}
        >
          <GitCommit className="w-5 h-5 text-primary shrink-0 transition-colors" />
          <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
            {t('common.layout.graph')}
          </span>
        </button>

        {/* REFRESH BUTTON */}
        <button
          type="button"
          disabled={isSyncing}
          onClick={refreshDiff}
          className="h-12 min-w-[58px] px-3 flex flex-col items-center justify-center hover:bg-surface0 text-subtext1 hover:text-text transition-colors disabled:opacity-40 cursor-pointer group rounded-sm"
          title={title('refresh_diff', t('common.layout.refreshDiffTitle'))}
        >
          <RotateCw className="w-5 h-5 text-primary shrink-0 transition-colors" />
          <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors">
            {t('common.layout.refresh')}
          </span>
        </button>

        {/* REPO SETTINGS BUTTON */}
        <button
          type="button"
          disabled={!currentRepo}
          onClick={() => openRepoSettings('remotes')}
          className="h-12 min-w-[68px] px-2.5 flex flex-col items-center justify-center hover:bg-surface0 text-subtext1 hover:text-text transition-colors disabled:opacity-40 cursor-pointer group rounded-sm"
          title={title('repo_settings', t('common.layout.repositorySettings'))}
        >
          <Cog className="w-5 h-5 text-primary shrink-0 transition-colors" />
          <span className="text-[11px] font-medium leading-none mt-1.5 tracking-tight transition-colors whitespace-nowrap">
            {t('common.layout.repositorySettings')}
          </span>
        </button>
      </div>
    </>
  );
};
