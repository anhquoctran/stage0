import React from 'react';
import { Play } from '../../../../common/components/icons/Play';
import { SkipForward } from '../../../../common/components/icons/SkipForward';
import { Undo2 } from '../../../../common/components/icons/Undo2';
import { useGitStore } from '../../../../features/git/store/useGitStore';

export const TopBarRebasingBanner: React.FC = () => {
  const { currentRepo, isRebasing, isSyncing, runSync } = useGitStore();

  if (!currentRepo || !isRebasing) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950 text-white text-xs rounded-sm">
      <span className="text-xs font-semibold text-amber-200 uppercase tracking-wider me-1">
        Rebasing:
      </span>
      <button
        type="button"
        disabled={isSyncing}
        onClick={() => runSync('rebase_continue')}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-medium transition-colors cursor-pointer rounded-sm"
        title="Continue rebase after resolving conflicts"
      >
        <Play className="w-3.5 h-3.5 text-white" />
        <span>Continue</span>
      </button>
      <button
        type="button"
        disabled={isSyncing}
        onClick={() => runSync('rebase_skip')}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-white text-xs font-medium transition-colors cursor-pointer rounded-sm"
        title="Skip this commit"
      >
        <SkipForward className="w-3.5 h-3.5 text-white" />
        <span>Skip</span>
      </button>
      <button
        type="button"
        disabled={isSyncing}
        onClick={() => runSync('rebase_abort')}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-red-900 hover:bg-red-800 text-white text-xs font-medium transition-colors cursor-pointer rounded-sm"
        title="Abort rebase and restore original state"
      >
        <Undo2 className="w-3.5 h-3.5 text-white" />
        <span>Abort</span>
      </button>
    </div>
  );
};

