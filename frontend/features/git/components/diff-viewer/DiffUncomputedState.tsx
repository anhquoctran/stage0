import React from 'react';
import { GitPullRequest } from '../../../../common/components/icons/GitPullRequest';
import type { RepoInfo } from '../../types/RepoInfo';

export const DiffUncomputedState: React.FC<{
  repo: RepoInfo;
}> = ({ repo }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-base p-8 text-center select-none rounded-sm">
      <div className="w-16 h-16 bg-mantle border border-surface0 flex items-center justify-center text-blue mb-4 shadow-md rounded-sm">
        <GitPullRequest className="w-8 h-8" />
      </div>
      <h3 className="text-[1rem] font-bold text-text mb-1">
        {repo.name}
      </h3>
      <p className="text-xs text-subtext1 max-w-sm mb-4 leading-relaxed font-mono">
        {repo.local_path}
      </p>
      <span className="text-xs text-subtext0">
        Comparing branches to compute 3-dot Virtual MR diff...
      </span>
    </div>
  );
};

