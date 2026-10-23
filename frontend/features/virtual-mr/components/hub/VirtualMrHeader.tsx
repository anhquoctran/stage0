import { XCircle } from '@/common/components/icons';
import { ArrowRight } from '../../../../common/components/icons/ArrowRight';
import { Check } from '../../../../common/components/icons/Check';
import { CheckCircle2 } from '../../../../common/components/icons/CheckCircle2';
import { Edit2 } from '../../../../common/components/icons/Edit2';
import { Lock } from '../../../../common/components/icons/Lock';
import { RefreshCw } from '../../../../common/components/icons/RefreshCw';
import { X } from '../../../../common/components/icons/X';
import { TabBranchSelector } from '../../../git/components/TabBranchSelector';
import { formatMrFriendlyId } from '../../utils/virtualMrSequence';
import type { VirtualMrHeaderProps } from './VirtualMrHeaderProps';

export function VirtualMrHeader({
  session,
  sequenceNumber,
  isEditingTitle,
  editTitle,
  setEditTitle,
  handleSaveTitle,
  setIsEditingTitle,
  handleStartEditTitle,
  isBranchLocked,
  branchLockedReason,
  branches,
  handleBranchChange,
  handleSwapBranches,
  hasAssignedReviewer,
  reviewBatch,
  reviewIsStarting,
  reviewIsRunning,
  handleStartAiReview,
}: VirtualMrHeaderProps) {
  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-4 border-b border-surface0/60 bg-crust/30 rounded-sm">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Read-only MR Status Badge */}
        {session.status === 'resolved' ? (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 select-none shadow-xs shrink-0 rounded-sm"
            title="All reviewers approved and all discussions are resolved"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Resolved</span>
          </div>
        ) : session.status === 'closed' ? (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-semibold bg-surface1/80 border border-surface2 text-subtext0 select-none shadow-xs shrink-0"
            title="Virtual MR is Closed"
          >
            <XCircle className="w-3.5 h-3.5 text-subtext1 shrink-0" />
            <span>Closed</span>
          </div>
        ) : (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 select-none shadow-xs shrink-0"
            title="Virtual MR is Open"
          >
            <span className="w-2 h-2 rounded-sm bg-emerald-400 animate-pulse shrink-0" />
            <span>Open</span>
          </div>
        )}

        {/* Friendly MR Sequence ID */}
        <span
          className="font-mono text-xs font-bold text-subtext0 shrink-0"
          title={`Virtual MR ${formatMrFriendlyId(sequenceNumber)}`}
        >
          {formatMrFriendlyId(sequenceNumber)}
        </span>

        {/* Title */}
        {isEditingTitle ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') setIsEditingTitle(false);
              }}
              className="flex-1 px-2.5 py-1 rounded-sm bg-surface0 border border-surface1 text-text text-sm font-semibold focus:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={handleSaveTitle}
              className="p-1 rounded-sm bg-brand hover:bg-brand/90 text-on-accent cursor-pointer shadow-xs"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditingTitle(false)}
              className="p-1 rounded-sm bg-surface1 hover:bg-surface2 text-white cursor-pointer"
              title="Cancel"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-semibold text-text truncate max-w-xs">{session.title}</h1>
            <button
              type="button"
              onClick={handleStartEditTitle}
              className="p-1 rounded-sm bg-surface1 hover:bg-surface2 text-white cursor-pointer"
              title="Edit title"
            >
              <Edit2 className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        )}

        {/* Branch Selector for Active Virtual MR */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 border shrink-0 transition-colors rounded-sm ${
            isBranchLocked
              ? 'bg-surface0/30 border-surface0/50'
              : 'bg-surface0/60 border-surface1/60'
          }`}
          title={isBranchLocked ? branchLockedReason : undefined}
        >
          <div className="flex items-center gap-1 mr-0.5">
            {isBranchLocked && (
              <Lock className="w-3 h-3 text-subtext0 shrink-0" title={branchLockedReason} />
            )}
            <span className="text-[10px] text-subtext0 uppercase font-mono tracking-wider font-semibold">
              Branch:
            </span>
          </div>
          <TabBranchSelector
            roleType="source"
            disabled={isBranchLocked}
            title={isBranchLocked ? branchLockedReason : undefined}
            value={session.compareBranch}
            branches={branches}
            onChange={(branch) => handleBranchChange(session.id, session.baseBranch, branch)}
          />
          <button
            type="button"
            onClick={() =>
              handleSwapBranches(session.id, session.baseBranch, session.compareBranch)
            }
            disabled={isBranchLocked}
            title={isBranchLocked ? branchLockedReason : 'Swap Compare and Base branches'}
            className={`p-1 border border-transparent transition-colors rounded-sm ${
              isBranchLocked
                ? 'text-subtext0/30 cursor-not-allowed'
                : 'text-subtext0 hover:text-brand hover:bg-surface0 hover:border-surface0 cursor-pointer'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <TabBranchSelector
            roleType="target"
            disabled={isBranchLocked}
            title={isBranchLocked ? branchLockedReason : undefined}
            value={session.baseBranch}
            branches={branches}
            onChange={(branch) => handleBranchChange(session.id, branch, session.compareBranch)}
          />
        </div>
      </div>

      {/* Global Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          disabled={
            !hasAssignedReviewer || Boolean(reviewBatch) || reviewIsStarting || reviewIsRunning
          }
          onClick={() => void handleStartAiReview()}
          title={
            !hasAssignedReviewer
              ? 'Add an AI bot to the Reviewers list to start a review'
              : reviewBatch
                ? `Reviewing ${reviewBatch.reviewerName} (${reviewBatch.current}/${reviewBatch.total})`
                : reviewIsRunning
                  ? 'An AI code review is already running'
                  : 'Start a review with every assigned AI reviewer'
          }
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white transition-colors font-medium text-xs cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-white ${reviewIsRunning ? 'animate-spin' : ''}`}
          />
          <span className="text-white">
            {reviewBatch
              ? reviewBatch.phase === 'preparing-description'
                ? `Summarizing MR · ${reviewBatch.current}/${reviewBatch.total}`
                : `Reviewing ${reviewBatch.reviewerName} · ${reviewBatch.current}/${reviewBatch.total}`
              : reviewIsStarting
                ? 'Starting review…'
                : reviewIsRunning
                  ? 'Review running…'
                  : 'AI code review'}
          </span>
        </button>
      </div>
    </div>
  );
}
