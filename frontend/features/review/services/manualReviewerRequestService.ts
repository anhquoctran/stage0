import { escapeMarkdownText } from '../../../common/utils/escapeMarkdownText';
import i18n from '../../i18n/i18n';
import { formatMention } from '../../../common/utils/mentions';
import type { VirtualMrComment } from '../../virtual-mr/types/VirtualMrComment';
import { getDiscussionComments } from '../../virtual-mr/utils/discussionReferences';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import { useReviewStore, isReviewStartingForSession } from '../store/useReviewStore';
import {
  getAssignedReviewerForSession,
  startAssignedReviewerReview,
  waitForReviewRun,
} from './assignedReviewService';

const handledRequests = new Set<string>();

function currentSession(sessionId: string) {
  return useVirtualMrStore.getState().sessions.find((session) => session.id === sessionId);
}

function busy(sessionId: string, ownBatch = false): boolean {
  const reviews = useReviewStore.getState();
  return Boolean(
    (!ownBatch && reviews.reviewBatches[sessionId])
    || isReviewStartingForSession(sessionId)
    || Object.values(reviews.activeRuns).some(
      (run) => run.sessionId === sessionId && run.status === 'running',
    ),
  );
}

function reviewerFindings(sessionId: string, reviewerId: string, reviewerName: string) {
  const session = currentSession(sessionId);
  return (session?.discussions || []).filter((discussion) => {
    if (!discussion.filePath || discussion.isResolved) return false;
    return getDiscussionComments(discussion).some((comment) =>
      comment.authorType === 'ai_agent'
      && (comment.authorId === reviewerId || comment.authorName === `Stage0 AI (${reviewerName})`),
    );
  });
}

function addPendingReply(sessionId: string, discussionId: string, reviewerId: string, reviewerName: string): string {
  const id = `manual-review-pending-${discussionId}-${reviewerId}`;
  const pending: VirtualMrComment = {
    id,
    discussionId,
    authorType: 'ai_agent',
    authorId: reviewerId,
    authorName: `Stage0 AI (${reviewerName})`,
    body: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPending: true,
    pendingLabel: i18n.t('reviewFlow.pendingLabel'),
  };
  useVirtualMrStore.setState((state) => ({
    sessions: state.sessions.map((session) => session.id !== sessionId ? session : {
      ...session,
      discussions: session.discussions.map((discussion) =>
        discussion.id !== discussionId || discussion.children.some((comment) => comment.id === id)
          ? discussion
          : { ...discussion, children: [...discussion.children, pending] },
      ),
    }),
  }));
  return id;
}

function removePendingReply(sessionId: string, discussionId: string, pendingId: string): void {
  useVirtualMrStore.setState((state) => ({
    sessions: state.sessions.map((session) => session.id !== sessionId ? session : {
      ...session,
      discussions: session.discussions.map((discussion) => discussion.id !== discussionId ? discussion : {
        ...discussion,
        children: discussion.children.filter((comment) => comment.id !== pendingId),
      }),
    }),
  }));
}

async function botReply(discussionId: string, reviewerId: string, reviewerName: string, body: string) {
  await useVirtualMrStore.getState().replyToDiscussion(
    discussionId,
    body,
    'comment',
    'ai_agent',
    `Stage0 AI (${reviewerName})`,
    reviewerId,
  );
}

function unresolvedReport(findings: ReturnType<typeof reviewerFindings>, reviewerId: string, reviewerName: string): string {
  const lines = findings.slice(0, 8).map((discussion) => {
    const location = `${discussion.filePath}:${discussion.lineNumber ?? 1}`;
    const finding = getDiscussionComments(discussion).find((comment) =>
      comment.authorType === 'ai_agent'
      && (comment.authorId === reviewerId || comment.authorName === `Stage0 AI (${reviewerName})`),
    );
    const title = finding?.body.split(/\r?\n/).find((line) => line.trim())
      ?.replace(/^\*\*|\*\*$/g, '').trim();
    const reference = `#mr-discussion/${encodeURIComponent(discussion.id)}`;
    return `- [${escapeMarkdownText(location)}](${reference})${title ? ` — ${escapeMarkdownText(title.slice(0, 140))}` : ''}`;
  });
  if (findings.length > lines.length) {
    lines.push(`- ${i18n.t('reviewFlow.moreFindings', { count: findings.length - lines.length })}`);
  }
  const command = `${formatMention({ id: reviewerId, label: reviewerName, kind: 'reviewer' })} review`;
  return `${i18n.t('reviewFlow.pausedTitle')}\n\n${i18n.t('reviewFlow.openFindings', { count: findings.length })}\n\n${lines.join('\n')}\n\n${i18n.t('reviewFlow.resolveThenRetry', { command: `\`${command}\`` })}`;
}

async function executeManualReviewerReview(
  sessionId: string,
  discussionId: string,
  reviewerId: string,
  ownBatch = false,
): Promise<void> {
  const requestKey = `${sessionId}:${discussionId}:${reviewerId}`;
  if (handledRequests.has(requestKey)) return;
  handledRequests.add(requestKey);
  if (handledRequests.size > 500) handledRequests.delete(handledRequests.values().next().value!);

  try {
    await useVirtualMrStore.getState().refreshDiscussions(sessionId);
  } catch {
    await botReply(discussionId, reviewerId, 'Reviewer', i18n.t('reviewFlow.reloadFailed'));
    return;
  }

  const assigned = getAssignedReviewerForSession(sessionId, reviewerId);
  if (!assigned) {
    await botReply(discussionId, reviewerId, 'Reviewer', i18n.t('reviewFlow.unassigned'));
    return;
  }
  if (!assigned.profile) {
    await botReply(discussionId, reviewerId, assigned.name, i18n.t('reviewFlow.profileUnavailable'));
    return;
  }
  const session = currentSession(sessionId);
  if (!session || session.status === 'closed') {
    await botReply(discussionId, reviewerId, assigned.name, i18n.t('reviewFlow.closed'));
    return;
  }

  const unresolved = reviewerFindings(sessionId, reviewerId, assigned.name);
  if (unresolved.length) {
    await botReply(discussionId, reviewerId, assigned.name, unresolvedReport(unresolved, reviewerId, assigned.name));
    return;
  }
  if (busy(sessionId, ownBatch)) {
    await botReply(discussionId, reviewerId, assigned.name, i18n.t('reviewFlow.busy'));
    return;
  }

  await botReply(
    discussionId,
    reviewerId,
    assigned.name,
    i18n.t('reviewFlow.accepted'),
  );
  const pendingId = addPendingReply(sessionId, discussionId, reviewerId, assigned.name);

  try {
    const run = await startAssignedReviewerReview(sessionId, reviewerId, discussionId);
    if (!run) throw new Error('Another AI review started before this request could begin. Retry after it finishes.');
    const finished = await waitForReviewRun(run.id);
    if (!['completed', 'partial'].includes(finished.status)) {
      throw new Error(finished.error || `The review ended with status ${finished.status}.`);
    }

    try {
      await useVirtualMrStore.getState().refreshDiscussions(sessionId);
    } catch (error) {
      console.warn('Could not refresh review discussions before notification:', error);
    }
    const after = currentSession(sessionId);
    const newFindings = (after?.discussions || []).filter((discussion) =>
      discussion.rootComment?.authorType === 'ai_agent'
      && discussion.rootComment.authorId === reviewerId
      && !session.discussions.some((before) => before.id === discussion.id),
    );
    removePendingReply(sessionId, discussionId, pendingId);
    const incomplete = finished.status === 'partial' ? i18n.t('reviewFlow.partialSuffix') : '';
    const summary = newFindings.length
      ? i18n.t('reviewFlow.completeWithFindings', { count: newFindings.length, incomplete })
      : i18n.t('reviewFlow.completeNoFindings', { incomplete });
    // The backend delivers completion once for every successful run.
    await botReply(discussionId, reviewerId, assigned.name, summary);
  } catch (error) {
    removePendingReply(sessionId, discussionId, pendingId);
    try {
      await useVirtualMrStore.getState().refreshDiscussions(sessionId);
      const latestUnresolved = reviewerFindings(sessionId, reviewerId, assigned.name);
      if (latestUnresolved.length) {
        await botReply(discussionId, reviewerId, assigned.name, unresolvedReport(latestUnresolved, reviewerId, assigned.name));
        return;
      }
    } catch {
      // Preserve the original run error when a refresh also fails.
    }
    const message = error instanceof Error ? error.message : String(error);
    await botReply(discussionId, reviewerId, assigned.name, i18n.t('reviewFlow.failed', { error: message }));
  }
}


/** Compatibility entry point for a single explicit reviewer. */
export function requestManualReviewerReview(sessionId: string, discussionId: string, reviewerId: string): Promise<void> {
  return executeManualReviewerReview(sessionId, discussionId, reviewerId);
}

const requestGroups = new Map<string, Promise<void>>();

/** One reserved batch per MR; never launch all mentioned models concurrently. */
export async function requestManualReviewerReviews(sessionId: string, discussionId: string, reviewerIds: string[]): Promise<void> {
  const key = `${sessionId}:${discussionId}`;
  const existing = requestGroups.get(key);
  if (existing) return existing;
  const ids = [...new Set(reviewerIds)];
  if (!ids.length) return;
  const run = async () => {
    if (ids.length === 1) return requestManualReviewerReview(sessionId, discussionId, ids[0]);
    if (busy(sessionId)) {
      for (const id of ids) {
        const name = getAssignedReviewerForSession(sessionId, id)?.name ?? 'Reviewer';
        await botReply(discussionId, id, name, i18n.t('reviewFlow.busy'));
      }
      return;
    }
    const { setReviewBatch } = useReviewStore.getState();
    try {
      for (const [index, id] of ids.entries()) {
        setReviewBatch(sessionId, { current: index + 1, total: ids.length, completed: index,
          reviewerName: getAssignedReviewerForSession(sessionId, id)?.name ?? 'Reviewer', phase: 'reviewing' });
        try { await executeManualReviewerReview(sessionId, discussionId, id, true); }
        catch (error) { console.warn('Could not process a manual reviewer request:', error); }
      }
    } finally { setReviewBatch(sessionId, null); }
  };
  const job = run();
  requestGroups.set(key, job);
  try { await job; } finally { if (requestGroups.get(key) === job) requestGroups.delete(key); }
}
