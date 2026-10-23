import { formatDateTime } from '../../../common/utils/dateTime';
import type { ReviewRunSummaryProps } from './ReviewRunSummaryProps';

export function ReviewRunSummary({ run, isPublishing, publish }: ReviewRunSummaryProps) {
  return (
    <section className="border border-surface1 p-3 space-y-2 text-xs">
      <p role="status">
        <strong className="uppercase">{run.status}</strong>
        {run.reviewerName && <> · {run.reviewerName}</>} · {run.provider} / {run.model} ·{' '}
        {run.findings.length} findings
      </p>
      <p className="break-all text-subtext0">Run endpoint: {run.endpoint}</p>
      <p className="font-mono text-[11px] break-all">
        {run.snapshot.repoPath}
        <br />
        base {run.snapshot.baseSha}
        <br />
        head {run.snapshot.headSha}
        <br />
        merge-base {run.snapshot.mergeBaseSha}
      </p>
      <p className="text-subtext0">
        {run.inspectedFiles.length} inspected paths · {run.snapshot.changedFiles.length} eligible
        changed paths · {run.snapshot.excludedFiles.length} excluded · {run.turns}/128 turns ·{' '}
        {run.toolCalls}/256 tool calls · {run.usageTokens} reported tokens
      </p>
      {run.retry && (
        <p role="status" className="border border-yellow/40 bg-yellow/5 p-2 text-yellow">
          {run.retry.reason === 'rate_limit'
            ? 'The agent’s provider is rate limiting requests'
            : 'The agent’s provider is temporarily unavailable'}
          {run.retry.httpStatus ? ` (HTTP ${run.retry.httpStatus})` : ''}. Waiting before retry{' '}
          {run.retry.attempt}/{run.retry.maxAttempts}. Next attempt:{' '}
          {formatDateTime(run.retry.retryAt)}. You can cancel the review while it waits.
        </p>
      )}
      {(run.status === 'partial' || run.status === 'incomplete') && (
        <p className="text-yellow">
          Incomplete coverage. Some source was excluded, redacted, unread, or a tool/budget limit
          was reached. Do not interpret zero findings as approval.
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
          <summary>Excluded changed paths</summary>
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
            ? 'Published to discussions'
            : isPublishing
              ? 'Publishing…'
              : 'Publish findings to discussions'}
        </button>
      )}
    </section>
  );
}
