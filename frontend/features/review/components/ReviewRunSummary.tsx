import { formatDateTime } from '../../../common/utils/dateTime';
import { useDateTimeLanguage } from '../../i18n/hooks/useDateTimeLanguage';
import type { ReviewRunSummaryProps } from './ReviewRunSummaryProps';
import { useTranslation } from 'react-i18next';

export function ReviewRunSummary({ run, isPublishing, publish }: ReviewRunSummaryProps) {
  useDateTimeLanguage();
  const { t } = useTranslation();
  return (
    <section className="border border-surface1 p-3 space-y-2 text-xs">
      <p role="status">
        <strong className="uppercase">{t(`review.runSummary.status.${run.status}`)}</strong>
        {run.reviewerName && <> · {run.reviewerName}</>} · {run.provider} / {run.model} ·{' '}
        {t('review.runSummary.findingsCount', { count: run.findings.length })}
      </p>
      {run.replyDiscussionId && (
        <p className="text-subtext0">{t('review.runSummary.replyOnly')}</p>
      )}
      <p className="break-all text-subtext0">{t('review.runSummary.endpoint', { endpoint: run.endpoint })}</p>
      <p className="font-mono text-[11px] break-all">
        {run.snapshot.repoPath}
        <br />
        {t('review.runSummary.base')} {run.snapshot.baseSha}
        <br />
        {t('review.runSummary.head')} {run.snapshot.headSha}
        <br />
        {t('review.runSummary.mergeBase')} {run.snapshot.mergeBaseSha}
      </p>
      <p className="text-subtext0">
        {t('review.runSummary.coverage', {
          inspected: run.inspectedFiles.length,
          eligible: run.snapshot.changedFiles.length,
          excluded: run.snapshot.excludedFiles.length,
          turns: run.turns,
          toolCalls: run.toolCalls,
          tokens: run.usageTokens,
        })}
      </p>
      {run.retry && (
        <p role="status" className="border border-yellow/40 bg-yellow/5 p-2 text-yellow">
          {run.retry.reason === 'rate_limit'
            ? t('review.runSummary.rateLimited')
            : t('review.runSummary.providerUnavailable')}
          {run.retry.httpStatus ? ` (${t('review.runSummary.httpStatus', { status: run.retry.httpStatus })})` : ''}.{' '}
          {t('review.runSummary.retryWaiting', {
            attempt: run.retry.attempt,
            maxAttempts: run.retry.maxAttempts,
            nextAttempt: formatDateTime(run.retry.retryAt),
          })}
        </p>
      )}
      {(run.status === 'partial' || run.status === 'incomplete') && (
        <p className="text-yellow">
          {t('review.runSummary.incompleteCoverage')}
        </p>
      )}
      {run.error && (
        <p role="alert" className="text-red whitespace-pre-wrap">
          {run.error}
        </p>
      )}
      <p className="whitespace-pre-wrap select-text">{run.summary}</p>
      {run.snapshot.excludedFiles.length > 0 && (
        <details>
          <summary>{t('review.runSummary.excludedPaths')}</summary>
          <pre className="max-h-28 overflow-auto text-[11px]">
            {run.snapshot.excludedFiles.join('\n')}
          </pre>
        </details>
      )}
      {['completed', 'partial'].includes(run.status) && run.findings.length > 0 && (
        <button
          type="button"
          disabled={run.published || isPublishing}
          onClick={() => void publish()}
          className="border border-primary text-primary px-3 py-2 disabled:opacity-40 rounded-sm"
        >
          {run.published
            ? t('review.runSummary.published')
            : isPublishing
              ? t('review.runSummary.publishing')
              : t('review.runSummary.publishFindings')}
        </button>
      )}
    </section>
  );
}
