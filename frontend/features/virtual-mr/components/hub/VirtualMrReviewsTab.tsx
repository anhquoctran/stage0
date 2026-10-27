import React, { useEffect, useMemo } from 'react';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { Bot } from '../../../../common/components/icons/Bot';
import { CheckCircle2 } from '../../../../common/components/icons/CheckCircle2';
import { RefreshCw } from '../../../../common/components/icons/RefreshCw';
import { ShieldCheck } from '../../../../common/components/icons/ShieldCheck';
import { Terminal } from '../../../../common/components/icons/Terminal';
import { formatDateTime } from '../../../../common/utils/dateTime';
import { useGitStore } from '../../../git/store/useGitStore';
import { ReviewFindingCard } from '../../../review/components/ReviewFindingCard';
import { ReviewRunSummary } from '../../../review/components/ReviewRunSummary';
import { useReviewStore } from '../../../review/store/useReviewStore';
import { createStartMrReviewAction } from '../../services/createStartMrReviewAction';
import { getManualReviewBlockReason } from '../../utils/manualReviewAvailability';
import type { VirtualMrReviewsTabProps } from './VirtualMrReviewsTabProps';

export const VirtualMrReviewsTab: React.FC<VirtualMrReviewsTabProps> = ({ session }) => {
  const { showToast } = useGitStore();
  const {
    sessionId: historySessionId,
    runs: historyRuns,
    detail: historyDetail,
    error,
    load,
    syncActive,
    publish,
    isPublishing,
    activeRuns,
    reviewBatches,
    isStarting,
  } = useReviewStore();
  const runs = historySessionId === session.id ? historyRuns : [];
  const detail = historySessionId === session.id && historyDetail?.run.sessionId === session.id
    ? historyDetail : null;

  useEffect(() => {
    if (session?.id) {
      void load(session.id);
    }
  }, [session?.id, load]);

  const activeIds = useMemo(() => Object.keys(activeRuns).sort().join(','), [activeRuns]);

  useEffect(() => {
    if (!activeIds) return;
    const timer = window.setInterval(() => void syncActive(), 1500);
    return () => window.clearInterval(timer);
  }, [activeIds, syncActive]);

  const handleStartReview = createStartMrReviewAction(session, showToast);
  const blockedReason = getManualReviewBlockReason(session);

  const reviewBatch = reviewBatches[session.id];
  const isRunning =
    Boolean(reviewBatch) ||
    isStarting ||
    Object.values(activeRuns).some((run) => run.sessionId === session.id && run.status === 'running');

  const run = detail?.run;
  const selectedRunId = run?.id || runs[0]?.id;

  const runOptions = useMemo(() => {
    return runs.map((item, index) => ({
      value: item.id,
      label: `Run #${runs.length - index} · ${item.reviewerName || 'AI Reviewer'} (${item.status}) · ${formatDateTime(item.startedAt)}`,
    }));
  }, [runs]);

  return (
    <div className="flex-1 h-full overflow-y-auto px-6 py-6 bg-crust/30 w-full">
      <div className="w-full space-y-6">
        {/* Top Controls Toolbar */}
        <div className="p-3.5 rounded-sm bg-mantle border border-surface0 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="font-semibold text-xs text-text">Review History</span>
            </div>
            {runs.length > 0 && (
              <CustomSelect
                value={selectedRunId}
                onChange={(id) => void load(session.id, id)}
                options={runOptions}
                className="w-72"
                buttonClassName="w-full text-xs"
                dropdownWidth="w-80"
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isRunning || !!blockedReason || session.reviewers.length === 0}
              title={blockedReason || undefined}
              onClick={handleStartReview}
              className="flex items-center gap-1.5 border-0 px-3 py-1.5 bg-primary hover:bg-primary/90 active:scale-98 text-on-accent font-medium text-xs cursor-pointer rounded-sm shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Review in progress…' : 'Run AI Code Review'}</span>
            </button>
          </div>
        </div>
        {blockedReason && <p role="status" className="text-xs text-subtext0">{blockedReason}</p>}
        {historySessionId === session.id && error && (
          <p role="alert" className="text-xs text-red whitespace-pre-wrap">{error}</p>
        )}

        {/* Live Running Banner */}
        {isRunning && (
          <div className="p-4 rounded-sm bg-primary/10 border border-primary/30 flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-primary animate-spin shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-primary">AI Review Active</p>
              <p className="text-subtext0">
                {reviewBatch
                  ? `${reviewBatch.reviewerName}: ${
                      reviewBatch.phase === 'preparing-description'
                        ? 'Summarizing changed files for description…'
                        : `Analyzing code changes (${reviewBatch.current}/${reviewBatch.total})…`
                    }`
                  : 'Automated AI reviewer is inspecting changes and evaluating findings…'}
              </p>
            </div>
          </div>
        )}

        {/* Selected Run Content */}
        {run ? (
          <div className="space-y-6">
            {/* Run Overview Summary */}
            <ReviewRunSummary run={run} isPublishing={isPublishing} publish={publish} />

            {/* Findings Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-surface0 pb-2">
                <h3 className="font-semibold text-xs text-text flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>Review Findings ({run.findings.length})</span>
                </h3>
              </div>

              {run.findings.length === 0 ? (
                <div className="p-5 rounded-sm bg-mantle border border-surface0/60 text-center space-y-1">
                  <CheckCircle2 className="w-5 h-5 text-green mx-auto" />
                  <p className="text-xs font-medium text-text">No issues found</p>
                  <p className="text-[11px] text-subtext0">
                    This review run did not report any errors or security warnings.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {run.findings.map((finding, idx) => (
                    <ReviewFindingCard key={`${run.id}-${idx}`} finding={finding} />
                  ))}
                </div>
              )}
            </div>

            {/* Run Trace Logs Section */}
            {detail?.events && detail.events.length > 0 && (
              <details className="rounded-sm bg-mantle border border-surface0 p-3 text-xs space-y-2 group">
                <summary className="font-medium text-subtext1 cursor-pointer select-none flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-subtext0" />
                  <span>Execution Trace & Logs ({detail.events.length} events)</span>
                </summary>
                <div className="mt-3 max-h-60 overflow-y-auto bg-base p-3 rounded-sm font-mono text-[11px] text-subtext0 space-y-1 border border-surface0">
                  {detail.events.map((event) => (
                    <div key={event.seq} className="leading-relaxed break-all">
                      <span className="text-primary font-bold">[{event.kind}]</span>{' '}
                      <span className="text-subtext1">{JSON.stringify(event.detail)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ) : !isRunning ? (
          /* Empty State when no reviews have been run yet */
          <div className="p-8 rounded-sm bg-mantle border border-surface0 text-center space-y-3">
            <Bot className="w-8 h-8 text-subtext0 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-text">No Bot Reviews Yet</h3>
              <p className="text-xs text-subtext0 max-w-md mx-auto">
                Trigger automated AI code reviews to analyze diffs, detect regressions, and evaluate
                security findings before merging your Virtual MR.
              </p>
            </div>
            {session.reviewers.length > 0 ? (
              <button
                type="button"
                disabled={!!blockedReason}
                title={blockedReason || undefined}
                onClick={handleStartReview}
                className="inline-flex items-center gap-2 border-0 px-4 py-2 bg-primary hover:bg-primary/90 text-on-accent text-xs font-medium rounded-sm cursor-pointer shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Start AI Code Review</span>
              </button>
            ) : (
              <p className="text-xs text-yellow">
                No reviewers are assigned to this MR. Add an AI reviewer in the metadata bar above to
                enable automated reviews.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
