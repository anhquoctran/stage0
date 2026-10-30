import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../../../common/utils/dateTime';
import { useDateTimeLanguage } from '../../i18n/hooks/useDateTimeLanguage';
import type { ReviewRun } from '../types/ReviewRun';
import { useReviewStore } from '../store/useReviewStore';

function statusLabel(t: (key: string) => string, status: ReviewRun['status']) {
  return t(`review.activity.states.${status}`);
}

export const ReviewActivity: React.FC = () => {
  const { t } = useTranslation();
  useDateTimeLanguage();
  const active = useReviewStore((state) => state.activeRuns);
  const finished = useReviewStore((state) => state.lastFinishedRun);
  const batches = useReviewStore((state) => state.reviewBatches);
  const syncActive = useReviewStore((state) => state.syncActive);
  const running = Object.values(active);
  const batch = Object.values(batches)[0];
  const activeIds = Object.keys(active).sort().join(',');
  const target = running[0] || finished;
  const waiting = running.find((run) => run.retry)?.retry;

  useEffect(() => {
    if (!activeIds) return;
    void syncActive();
    const timer = window.setInterval(() => void syncActive(), 1500);
    return () => window.clearInterval(timer);
  }, [activeIds, syncActive]);

  if (!target && !batch) return null;
  const label = waiting
    ? t('review.activity.waiting', {
        reason: t(waiting.reason === 'rate_limit' ? 'review.activity.rateLimited' : 'review.activity.waitingForProvider'),
        attempt: waiting.attempt,
        maxAttempts: waiting.maxAttempts,
      })
    : batch
    ? t('review.activity.batchProgress', {
        phase: t(batch.phase === 'preparing-description' ? 'review.activity.summarizingMr' : 'review.activity.reviewing'),
        current: batch.current,
        total: batch.total,
      })
    : running.length
      ? t('review.activity.runningCount', { count: running.length })
      : target!.findings.length
        ? t('review.activity.finishedWithFindings', {
            status: statusLabel(t, target!.status),
            count: target!.findings.length,
          })
        : t('review.activity.finished', { status: statusLabel(t, target!.status) });

  const title = waiting
    ? t(waiting.httpStatus ? 'review.activity.retryTitleWithStatus' : 'review.activity.retryTitle', {
        provider: waiting.httpStatus ? `HTTP ${waiting.httpStatus}` : undefined,
        time: formatTime(new Date(waiting.retryAt).getTime()),
      })
    : batch
      ? t('review.activity.batchTitle', { reviewer: batch.reviewerName, label })
      : target!.error || target!.summary || t('review.activity.defaultTitle');

  return (
    <span
      role="status"
      title={title}
      className={`px-2 text-[10px] ${waiting ? 'text-yellow' : 'text-primary'}`}
    >
      {label}
    </span>
  );
};
