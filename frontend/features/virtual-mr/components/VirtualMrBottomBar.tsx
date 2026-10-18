import React from 'react';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { XCircle } from '@/common/components/icons';
import { RotateCcw } from '../../../common/components/icons/RotateCcw';
import { Bot } from '../../../common/components/icons/Bot';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { ArrowRight } from '../../../common/components/icons/ArrowRight';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import { useGitStore } from '../../git/store/useGitStore';

export const VirtualMrBottomBar: React.FC = () => {
  const { currentRepo, showToast } = useGitStore();
  const { getActiveSession, updateSessionStatus } = useVirtualMrStore();

  const session = getActiveSession();

  if (!currentRepo || !session) return null;

  const unresolvedDiscussions = session.discussions.filter((d) => !d.isResolved);
  const unresolvedCount = unresolvedDiscussions.length;

  const handleCloseRequest = async () => {
    await updateSessionStatus(session.id, 'closed');
    showToast(`Virtual MR #${session.title} closed`);
  };

  const handleReopenRequest = async () => {
    await updateSessionStatus(session.id, 'open');
    showToast(`Virtual MR #${session.title} reopened`);
  };

  return (
    <div className="h-14 bg-mantle/95 backdrop-blur-xs border-t border-surface0 px-5 flex items-center justify-between shrink-0 select-none z-20 shadow-md">
      {/* Left: MR Status, Branch Flow & AI Auditor State */}
      <div className="flex items-center gap-4 min-w-0">
        {/* Status Badge */}
        {session.status === 'approved' ? (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300 shrink-0 shadow-xs"
            title="Saved approval status. No evidence-backed AI review is recorded."
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Approved</span>
          </div>
        ) : session.status === 'closed' ? (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface1/80 border border-surface2 text-subtext0 shrink-0 shadow-xs"
            title="Virtual MR is Closed"
          >
            <XCircle className="w-3.5 h-3.5 text-subtext1 shrink-0" />
            <span>Closed</span>
          </div>
        ) : (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0 shadow-xs"
            title="Virtual MR is Open"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>Open</span>
          </div>
        )}

        {/* Branch Routing Pill */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-subtext0 hidden sm:flex">
          <GitPullRequest className="w-3.5 h-3.5 text-brand shrink-0" />
          <span className="px-2 py-0.5 rounded bg-surface0 text-accent font-semibold">
            {session.compareBranch}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-subtext1" />
          <span className="px-2 py-0.5 rounded bg-surface0 text-subtext1">
            {session.baseBranch}
          </span>
        </div>

        {/* AI Auditor Review Status Indicator */}
        <div className="flex items-center gap-2 pl-3 border-l border-surface0/60 hidden md:flex">
          {unresolvedCount > 0 ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{unresolvedCount} open discussion{unresolvedCount > 1 ? 's' : ''}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-subtext0 font-medium">
              <Bot className="w-3.5 h-3.5 text-accent shrink-0" />
              <span>No evidence-backed approval recorded</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Large Prominent Close / Reopen Button */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Prominent Large Close / Reopen Request Button */}
        {session.status === 'closed' ? (
          <button
            type="button"
            onClick={handleReopenRequest}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold tracking-wide shadow-sm transition-all duration-150 cursor-pointer"
            title="Reopen this Virtual MR request"
          >
            <RotateCcw className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Reopen request</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCloseRequest}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-bold tracking-wide shadow-sm transition-all duration-150 cursor-pointer"
            title="Close this Virtual MR request"
          >
            <XCircle className="w-4 h-4 text-white stroke-[2.5]" />
            <span>Close request</span>
          </button>
        )}
      </div>
    </div>
  );
};
