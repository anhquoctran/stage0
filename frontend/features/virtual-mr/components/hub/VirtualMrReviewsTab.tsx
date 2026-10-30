import React, { useEffect, useMemo } from 'react';
import { Trans, useTranslation as useUiTextTranslation } from 'react-i18next';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { Bot } from '../../../../common/components/icons/Bot';
import { CheckCircle2 } from '../../../../common/components/icons/CheckCircle2';
import { RefreshCw } from '../../../../common/components/icons/RefreshCw';
import { ShieldCheck } from '../../../../common/components/icons/ShieldCheck';
import { Terminal } from '../../../../common/components/icons/Terminal';
import { formatDateTime } from '../../../../common/utils/dateTime';
import { useDateTimeLanguage } from '../../../i18n/hooks/useDateTimeLanguage';
import { ReviewFindingCard } from '../../../review/components/ReviewFindingCard';
import { ReviewRunSummary } from '../../../review/components/ReviewRunSummary';
import { useReviewStore } from '../../../review/store/useReviewStore';
import type { VirtualMrReviewsTabProps } from './VirtualMrReviewsTabProps';

export const VirtualMrReviewsTab: React.FC<VirtualMrReviewsTabProps> = ({ session }) => {
  const { t: translateUiText } = useUiTextTranslation();
  const uiLanguage = useDateTimeLanguage();
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
      label: translateUiText('virtualMr.reviews.runOption', {
        index: runs.length - index,
        reviewer: item.reviewerName || translateUiText('virtualMr.reviews.aiReviewer'),
        status: translateUiText(`review.runSummary.status.${item.status}`),
        date: formatDateTime(item.startedAt),
      }),
    }));
  }, [runs, uiLanguage, translateUiText]);

  return (
    <div className="flex-1 h-full overflow-y-auto px-6 py-6 bg-crust/30 w-full">
      <div className="w-full space-y-6">
        {/* Top Controls Toolbar */}
        <div className="p-3.5 rounded-sm bg-mantle border border-surface0 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="font-semibold text-xs text-text">{translateUiText('virtualMr.reviews.history')}</span>
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
            <p className="text-[11px] text-subtext0"><Trans i18nKey="virtualMr.reviews.requestInDiscussion" components={{ command: <code className="rounded-sm bg-surface0 px-1" /> }} /></p>
          </div>
        </div>
        {historySessionId === session.id && error && (
          <p role="alert" className="text-xs text-red whitespace-pre-wrap">{error}</p>
        )}

        {/* Live Running Banner */}
        {isRunning && (
          <div className="p-4 rounded-sm bg-primary/10 border border-primary/30 flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-primary animate-spin shrink-0" />
            <div className="text-xs">
              <p className="font-semibold text-primary">{translateUiText('virtualMr.reviews.active')}</p>
              <p className="text-subtext0">
                {reviewBatch
                  ? translateUiText('virtualMr.reviews.reviewerActivity', {
                      reviewer: reviewBatch.reviewerName,
                      activity: reviewBatch.phase === 'preparing-description'
                        ? translateUiText('virtualMr.reviews.summarizingFiles')
                        : translateUiText('virtualMr.reviews.analyzingChanges', { current: reviewBatch.current, total: reviewBatch.total }),
                    })
                  : translateUiText('virtualMr.reviews.automatedReviewerActivity')}
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
                  <span>{translateUiText('virtualMr.reviews.findingsCount', { count: run.findings.length })}</span>
                </h3>
              </div>

              {run.findings.length === 0 ? (
                <div className="p-5 rounded-sm bg-mantle border border-surface0/60 text-center space-y-1">
                  <CheckCircle2 className="w-5 h-5 text-green mx-auto" />
                  <p className="text-xs font-medium text-text">{translateUiText('virtualMr.reviews.noIssues')}</p>
                  <p className="text-[11px] text-subtext0">
                    {translateUiText('virtualMr.reviews.noIssuesDescription')}
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
                  <span>{translateUiText('virtualMr.reviews.executionTrace', { count: detail.events.length })}</span>
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
              <h3 className="text-sm font-semibold text-text">{translateUiText('virtualMr.reviews.noReviews')}</h3>
              <p className="text-xs text-subtext0 max-w-md mx-auto">
                <Trans i18nKey="virtualMr.reviews.noReviewsDescription" components={{ command: <code className="rounded-sm bg-surface0 px-1" /> }} />
              </p>
            </div>
            {session.reviewers.length === 0 && (
              <p className="text-xs text-yellow">
                {translateUiText('virtualMr.reviews.noReviewersAssigned')}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
