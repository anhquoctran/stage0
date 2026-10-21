import React from 'react';
import { FolderGit2 } from '../../../../common/components/icons/FolderGit2';
import { useGitStore } from '../../../../features/git/store/useGitStore';

export const TopBarRepoBadge: React.FC = () => {
  const { currentRepo } = useGitStore();

  if (!currentRepo) {
    return (
      <div className="flex items-center gap-2.5 px-3.5 h-12 bg-surface0 text-subtext0 text-xs select-none shrink-0">
        <FolderGit2 className="w-4 h-4 text-subtext0 shrink-0" />
        <span>No Repository Opened</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 px-3.5 h-12 bg-surface0 text-left max-w-[260px] select-none shrink-0"
      title={currentRepo.local_path}
    >
      <FolderGit2 className="w-5 h-5 text-primary shrink-0" />
      <div className="min-w-0">
        <span className="block font-semibold text-text truncate leading-tight text-xs">
          {currentRepo.name}
        </span>
        <span className="block text-[10px] text-subtext0 truncate leading-tight font-mono">
          {currentRepo.local_path}
        </span>
      </div>
    </div>
  );
};

