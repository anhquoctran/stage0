import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import i18n from '../../i18n/i18n';

import { useAiMcpStore } from '../../ai/store/useAiMcpStore';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { resolveReviewBotConfig } from '../utils/resolveReviewBotConfig';
import { isReviewStartingForSession, useReviewStore } from '../store/useReviewStore';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import type { ReviewRun } from '../types/ReviewRun';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import { discussionReplyRecipients } from '../utils/discussionReplyRecipients';
import { getDiscussionComments } from '../../virtual-mr/utils/discussionReferences';
import { discussionReplyVersion } from '../utils/discussionReplyVersion';

const attemptedHeadBySession = new Map<string, string>();
const checkingSession = new Set<string>();
const queuedReReviewSessions = new Set<string>();
const queuedDiscussionReplies = new Map<string, Set<string>>();
const replyingSessions = new Set<string>();
const attemptedReplyComments = new Map<string, string>();

function reviewersForSession(sessionId: string) {
  const virtualMr = useVirtualMrStore.getState();
  const session = virtualMr.sessions.find((item) => item.id === sessionId);
  if (!session?.reviewers.length) return null;
  const profiles = useBotReviewersStore.getState();
  const profileById = new Map<string, BotReviewer>([
    ...profiles.globalReviewers,
    ...(profiles.repoCustomReviewers[session.repoId] || []),
  ].map((reviewer) => [reviewer.id, reviewer]));
  const seen = new Set<string>();
  const reviewers = session.reviewers.flatMap((assignment) => {
    if (seen.has(assignment.agentId)) return [];
    seen.add(assignment.agentId);
    return [{
      id: assignment.agentId,
      name: assignment.agentName,
      profile: profileById.get(assignment.agentId) || null,
    }];
  });
  return { session, reviewers };
}

export function getAssignedReviewerForSession(sessionId: string, reviewerId: string) {
  return reviewersForSession(sessionId)?.reviewers.find((reviewer) => reviewer.id === reviewerId) || null;
}

function configForReviewer(reviewer: BotReviewer) {
  const aiState = useAiMcpStore.getState();
  const reviewerProvider = reviewer.provider && reviewer.provider !== 'global_default'
    ? reviewer.provider as keyof typeof aiState.dynamicModels
    : aiState.aiConfig.provider;
  const config = resolveReviewBotConfig(
    aiState.aiConfig,
    reviewer,
    aiState.dynamicModels[reviewerProvider] || [],
    aiState.externalAgents,
  );
  if (reviewer.acpAgentId && !config.acpAgent) {
    throw new Error(`ACP agent for reviewer “${reviewer.name}” is no longer installed. Update or remove this reviewer profile.`);
  }
  return config;
}

function sourceTransferAllowed(config: ReturnType<typeof configForReviewer>): boolean {
  if (config.executionMode === 'acp') {
    if (!config.allowAcpSourceTransfer) {
      throw new Error('Source sharing is not enabled for this ACP reviewer. Edit the reviewer and explicitly allow eligible source to be sent to its agent.');
    }
    return true;
  }
  return config.provider !== 'ollama';
}

export async function startAssignedReviewForSession(sessionId: string): Promise<ReviewRun | null> {
  const assigned = reviewersForSession(sessionId)?.reviewers.find((reviewer) => reviewer.profile);
  if (!assigned?.profile) return null;
  const config = configForReviewer(assigned.profile);
  return useReviewStore.getState().startForSession(
    sessionId,
    config,
    sourceTransferAllowed(config),
    { id: assigned.id, name: assigned.name },
  );
}

export async function startAssignedReviewerReview(
  sessionId: string,
  reviewerId: string,
  manualReviewDiscussionId: string,
): Promise<ReviewRun | null> {
  const assigned = getAssignedReviewerForSession(sessionId, reviewerId);
  if (!assigned?.profile) return null;
  const config = configForReviewer(assigned.profile);
  return useReviewStore.getState().startForSession(
    sessionId,
    config,
    sourceTransferAllowed(config),
    { id: assigned.id, name: assigned.name },
    false,
    undefined,
    manualReviewDiscussionId,
  );
}

export interface AssignedReviewBatchResult {
  runs: ReviewRun[];
  failures: string[];
  descriptionGenerated: boolean;
  hasChanges: boolean;
}

export async function waitForReviewRun(runId: string, onUpdate: (run: ReviewRun) => void | Promise<void> = () => {}): Promise<ReviewRun> {
  const deadline = Date.now() + 330_000;
  while (Date.now() < deadline) {
    const detail = await getApplicationServices().reviews.getAiReview({ runId });
    await useReviewStore.getState().syncRun(detail);
    await onUpdate(detail.run);
    if (detail.run.status !== 'running') {
      return detail.run;
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  throw new Error('Timed out waiting for the AI review run to finish.');
}

async function waitForSessionIdle(sessionId: string, includeBatch = false): Promise<void> {
  const deadline = Date.now() + 330_000;
  while (Date.now() < deadline) {
    const store = useReviewStore.getState();
    const active = Object.values(store.activeRuns).some((run) => run.sessionId === sessionId && run.status === 'running');
    if (!active && !isReviewStartingForSession(sessionId) && (!includeBatch || !store.reviewBatches[sessionId])) return;
    await store.syncActive();
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error('Timed out waiting for another review of this Virtual MR to finish.');
}

/** User comments enqueue bounded replies; they never start a full MR review. */
export async function queueAssignedDiscussionReply(sessionId: string, discussionId: string): Promise<void> {
  const pending = queuedDiscussionReplies.get(sessionId) || new Set<string>();
  pending.add(discussionId);
  queuedDiscussionReplies.set(sessionId, pending);
  if (replyingSessions.has(sessionId)) return;
  replyingSessions.add(sessionId);
  try {
    while (pending.size) {
      const target = pending.values().next().value!;
      pending.delete(target);
      try {
        await waitForSessionIdle(sessionId, true);
        const assigned = reviewersForSession(sessionId);
        if (!assigned || assigned.session.status === 'closed') continue;
        const ids = assigned.reviewers.filter((reviewer) => reviewer.profile).map((reviewer) => reviewer.id);
        for (const reviewer of assigned.reviewers) {
          const current = useVirtualMrStore.getState().sessions.find((item) => item.id === sessionId);
          const discussion = current?.discussions.find((item) => item.id === target);
          if (!discussion || current?.status === 'closed' || !reviewer.profile
            || !discussionReplyRecipients(discussion, ids).includes(reviewer.id)) continue;
          const latest = getDiscussionComments(discussion).at(-1);
          if (!latest) continue;
          const key = `${sessionId}:${target}:${reviewer.id}`;
          const version = await discussionReplyVersion(latest);
          if (version && attemptedReplyComments.get(key) === version) continue;
          await waitForSessionIdle(sessionId, true);
          const config = configForReviewer(reviewer.profile);
          const run = await useReviewStore.getState().startForSession(sessionId, config,
            sourceTransferAllowed(config), { id: reviewer.id, name: reviewer.name }, false, target);
          if (!run) { pending.add(target); break; }
          const finished = await waitForReviewRun(run.id, () => {});
          if (!['completed', 'partial'].includes(finished.status)) throw new Error(finished.error || i18n.t('review.toasts.discussionReplyIncomplete'));
          if (version) attemptedReplyComments.set(key, version);
          if (attemptedReplyComments.size > 500) attemptedReplyComments.delete(attemptedReplyComments.keys().next().value!);
        }
      } catch (error) {
        useGitStore.getState().showToast(i18n.t('review.toasts.reviewerCouldNotReply', { error: error instanceof Error ? error.message : String(error) }), 'warning');
      }
    }
  } finally {
    replyingSessions.delete(sessionId);
    queuedDiscussionReplies.delete(sessionId);
  }
}

export async function startAssignedReviewBatchForSession(sessionId: string): Promise<AssignedReviewBatchResult> {
  const assigned = reviewersForSession(sessionId);
  if (!assigned) return { runs: [], failures: [], descriptionGenerated: false, hasChanges: false };
  if (assigned.session.status === 'closed') {
    return { runs: [], failures: [i18n.t('review.toasts.closedMr')], descriptionGenerated: false, hasChanges: false };
  }

  const store = useReviewStore.getState();
  if (store.reviewBatches[sessionId]
    || isReviewStartingForSession(sessionId)
    || Object.values(store.activeRuns).some((run) => run.sessionId === sessionId && run.status === 'running')) {
    throw new Error('An AI review is already starting or running for this Virtual MR.');
  }

  const result: AssignedReviewBatchResult = { runs: [], failures: [], descriptionGenerated: false, hasChanges: false };
  const { setReviewBatch } = store;
  try {
    await useVirtualMrStore.getState().resetReviewerReviews(sessionId);
    for (let index = 0; index < assigned.reviewers.length; index++) {
      const reviewer = assigned.reviewers[index];
      if (index > 0) await waitForSessionIdle(sessionId);
      const generateDescription = !result.descriptionGenerated;
      setReviewBatch(sessionId, {
        current: index + 1,
        total: assigned.reviewers.length,
        completed: index,
        reviewerName: reviewer.name,
        phase: generateDescription ? 'preparing-description' : 'reviewing',
      });

      if (!reviewer.profile) {
        result.failures.push(i18n.t('review.toasts.reviewerConfigurationUnavailable', { reviewer: reviewer.name }));
        continue;
      }

      try {
        const config = configForReviewer(reviewer.profile);
        const run = await useReviewStore.getState().startForSession(
          sessionId,
          config,
          sourceTransferAllowed(config),
          { id: reviewer.id, name: reviewer.name },
          generateDescription,
        );
        if (!run) {
          result.failures.push(i18n.t('review.toasts.anotherReviewRunning', { reviewer: reviewer.name }));
          continue;
        }

        const finished = await waitForReviewRun(run.id, (updatedRun) => {
          result.hasChanges ||= updatedRun.snapshot.changedFiles.length > 0 || updatedRun.snapshot.excludedFiles.length > 0;
          if (!result.descriptionGenerated && updatedRun.generatedDescription?.trim()) {
            result.descriptionGenerated = true;
            const progress = useReviewStore.getState().reviewBatches[sessionId];
            if (progress) useReviewStore.getState().setReviewBatch(sessionId, { ...progress, phase: 'reviewing' });
          }
        });
        result.runs.push(finished);
        result.hasChanges ||= finished.snapshot.changedFiles.length > 0 || finished.snapshot.excludedFiles.length > 0;
        if (!result.descriptionGenerated && finished.generatedDescription?.trim()) {
          result.descriptionGenerated = true;
        }
        if (finished.status !== 'completed' && finished.status !== 'partial') {
          result.failures.push(i18n.t('review.toasts.reviewerRunFailed', {
            reviewer: reviewer.name,
            error: finished.error || i18n.t('review.toasts.reviewEndedWithStatus', { status: i18n.t(`review.activity.states.${finished.status}`) }),
          }));
        }
      } catch (error) {
        result.failures.push(i18n.t('review.toasts.reviewerRunFailed', { reviewer: reviewer.name, error: error instanceof Error ? error.message : String(error) }));
      }
    }
    if (!result.descriptionGenerated && result.runs.some((run) => run.snapshot.changedFiles.length > 0)) {
      result.failures.push(i18n.t('review.toasts.descriptionNotGenerated'));
    }
    return result;
  } finally {
    useReviewStore.getState().setReviewBatch(sessionId, null);
  }
}

export async function reReviewAssignedSession(sessionId: string): Promise<void> {
  const currentSession = useVirtualMrStore.getState().sessions.find((item) => item.id === sessionId);
  if (!currentSession || currentSession.status === 'closed' || !currentSession.reviewers.length) return;
  if (Object.values(useReviewStore.getState().activeRuns).some((run) => run.sessionId === sessionId && run.status === 'running')) {
    queuedReReviewSessions.add(sessionId);
    return;
  }
  if (isReviewStartingForSession(sessionId)) {
    queuedReReviewSessions.add(sessionId);
    return;
  }
  try {
    const result = await startAssignedReviewBatchForSession(sessionId);
    if (result.failures.length > 0) {
      useGitStore.getState().showToast(i18n.t('review.toasts.someReviewersCouldNotFinish', { errors: result.failures.join('; ') }), 'warning');
    }
    if (result.runs.length === 0 && (isReviewStartingForSession(sessionId) || Object.values(useReviewStore.getState().activeRuns).some((item) => item.sessionId === sessionId && item.status === 'running'))) {
      queuedReReviewSessions.add(sessionId);
    }
  } catch (error) {
    queuedReReviewSessions.delete(sessionId);
    useGitStore.getState().showToast(i18n.t('review.toasts.reviewerCouldNotStart', { error: error instanceof Error ? error.message : String(error) }), 'error');
  }
}

export async function flushQueuedReReviewAfterActive(sessionId: string): Promise<void> {
  if (!queuedReReviewSessions.delete(sessionId)) return;
  await reReviewAssignedSession(sessionId);
}

export async function reviewAssignedSessionAfterGitChange(repoPath: string): Promise<void> {
  const virtualMr = useVirtualMrStore.getState();
  const session = virtualMr.getActiveSession();
  if (!session || virtualMr.currentRepoPath !== repoPath || session.status === 'closed' || !session.reviewers.length || checkingSession.has(session.id)) return;
  checkingSession.add(session.id);
  try {
    const [baseSha, headSha] = await Promise.all([
      getApplicationServices().gitHistory.getGitRefSha({ repoPath, reference: session.baseBranch }),
      getApplicationServices().gitHistory.getGitRefSha({ repoPath, reference: session.compareBranch }),
    ]);
    const revisionKey = `${baseSha}:${headSha}`;
    if (!baseSha || !headSha || attemptedHeadBySession.get(session.id) === revisionKey) return;
    const existingRun = Object.values(useReviewStore.getState().activeRuns)
      .find((run) => run.sessionId === session.id && run.status === 'running');
    if (existingRun) {
      if (existingRun.snapshot.headSha === headSha && existingRun.snapshot.baseSha === baseSha) {
        attemptedHeadBySession.set(session.id, revisionKey);
      } else {
        attemptedHeadBySession.set(session.id, revisionKey);
        queuedReReviewSessions.add(session.id);
      }
      return;
    }
    const runs = await getApplicationServices().reviews.listAiReviews({ sessionId: session.id });
    const latestRun = [...runs].sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
    if (latestRun?.snapshot.headSha === headSha && latestRun.snapshot.baseSha === baseSha) {
      attemptedHeadBySession.set(session.id, revisionKey);
      return;
    }
    attemptedHeadBySession.set(session.id, revisionKey);
    const batch = await startAssignedReviewBatchForSession(session.id);
    if (batch.failures.length > 0) {
      useGitStore.getState().showToast(i18n.t('review.toasts.someReviewersCouldNotFinish', { errors: batch.failures.join('; ') }), 'warning');
    }
    if (batch.runs.length === 0 && (isReviewStartingForSession(session.id) || Object.values(useReviewStore.getState().activeRuns).some((run) => run.sessionId === session.id && run.status === 'running'))) {
      queuedReReviewSessions.add(session.id);
    }
  } catch (error) {
    queuedReReviewSessions.delete(session.id);
    useGitStore.getState().showToast(i18n.t('review.toasts.reviewerCouldNotCheckUpdatedMr', { error: error instanceof Error ? error.message : String(error) }), 'error');
  } finally {
    checkingSession.delete(session.id);
  }
}
