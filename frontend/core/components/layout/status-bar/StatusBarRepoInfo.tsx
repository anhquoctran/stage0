import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderGit2 } from '../../../../common/components/icons/FolderGit2';
import { GitBranch } from '../../../../common/components/icons/GitBranch';
import { useGitStore } from '../../../../features/git/store/useGitStore';

export const StatusBarRepoInfo: React.FC = () => {
  const { t } = useTranslation();
  const { currentRepo, branches } = useGitStore();

  return (
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      {currentRepo ? (
        <>
          <div
            className="flex items-center gap-1.5 text-subtext1 hover:text-text transition-colors truncate cursor-default"
            title={currentRepo.local_path}
          >
            <FolderGit2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span dir="auto" className="font-semibold text-text truncate">{currentRepo.name}</span>
          </div>

          {branches?.current && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-surface0/50 border border-surface1/50 text-text font-mono text-[11px] shrink-0 max-w-[45vw] rounded-sm">
              <GitBranch className="w-3 h-3 text-blue shrink-0" />
              <span dir="ltr" className="truncate max-w-[200px] max-xl:max-w-[120px] max-sm:max-w-[18vw]">
                {branches.current}
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-1.5 text-subtext0">
          <FolderGit2 className="w-3.5 h-3.5" />
          <span>{t('common.layout.noRepositoryOpen')}</span>
        </div>
      )}
    </div>
  );
};

