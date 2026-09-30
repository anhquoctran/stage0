import React from 'react';
import { GitPullRequest, Plus, Sparkles, FolderGit2 } from 'lucide-react';

interface Props {
  onNewMr: () => void;
  repoName?: string;
  defaultBaseBranch?: string;
}

export const EmptyVirtualMrWorkspace: React.FC<Props> = ({
  onNewMr,
  repoName,
  defaultBaseBranch = 'main',
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-crust select-none text-center font-sans">
      <div className="max-w-md flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        {/* Glowing Icon Container */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 bg-gradient-to-r from-brand/20 via-mauve/15 to-teal/20 rounded-3xl blur-xl" />
          <div className="relative w-16 h-16 rounded-2xl bg-mantle border border-surface1 flex items-center justify-center text-brand shadow-xl">
            <GitPullRequest className="w-8 h-8 text-brand" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-lg font-bold text-text mb-2">
          No Active Virtual MR Sessions
        </h2>

        {/* Subtitle */}
        <p className="text-xs text-subtext0 leading-relaxed mb-6">
          {repoName ? (
            <>
              All Virtual MR tabs in repository <span className="font-mono text-text font-medium">{repoName}</span> have been closed.
            </>
          ) : (
            'All Virtual MR tabs have been closed.'
          )}{' '}
          Create a new session to compare diffs, detect merge conflicts in sandbox, and run AI code review bots.
        </p>

        {/* Primary CTA Button */}
        <button
          type="button"
          onClick={onNewMr}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand hover:bg-brand/90 active:scale-[0.98] text-[#11111b] font-semibold text-xs transition-all shadow-lg shadow-brand/20 cursor-pointer mb-4"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Create Virtual MR</span>
          <kbd className="ml-1.5 px-1.5 py-0.5 text-[10px] font-mono bg-black/15 rounded text-[#11111b]/80 border border-black/10">
            Ctrl+T
          </kbd>
        </button>

        {/* Quick Tips / Badges */}
        <div className="flex items-center gap-4 text-[11px] text-subtext1 pt-4 border-t border-surface0/60">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand" />
            <span>AI Bot auto-review</span>
          </div>
          <span className="text-surface1">•</span>
          <div className="flex items-center gap-1.5">
            <FolderGit2 className="w-3.5 h-3.5 text-accent" />
            <span>Target branch: {defaultBaseBranch}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
