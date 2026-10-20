import { invoke } from '@tauri-apps/api/core';
import { useAiMcpStore } from '../../ai/store/useAiMcpStore';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { resolveReviewBotConfig } from '../utils/resolveReviewBotConfig';
import { isReviewStartingForSession, useReviewStore } from '../store/useReviewStore';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import type { ReviewRun } from '../types/ReviewRun';

const attemptedHeadBySession = new Map<string, string>();
const checkingSession = new Set<string>();
const queuedReReviewSessions = new Set<string>();

function reviewerForSession(sessionId: string) {
  const virtualMr = useVirtualMrStore.getState();
  const session = virtualMr.sessions.find((item) => item.id === sessionId);
  if (!session?.reviewers.length) return null;
  const reviewerId = session.reviewers[0].agentId;
  const profiles = useBotReviewersStore.getState();
  const reviewer = [
    ...profiles.globalReviewers,
    ...(profiles.repoCustomReviewers[session.repoId] || []),
  ].find((item) => item.id === reviewerId);
  return reviewer ? { session, reviewer } : null;
}

export async function startAssignedReviewForSession(sessionId: string): Promise<ReviewRun | null> {
  const assigned = reviewerForSession(sessionId);
  if (!assigned) return null;
  const aiState = useAiMcpStore.getState();
  const reviewerProvider = assigned.reviewer.provider && assigned.reviewer.provider !== 'global_default'
    ? assigned.reviewer.provider as keyof typeof aiState.dynamicModels
    : aiState.aiConfig.provider;
  const config = resolveReviewBotConfig(
    aiState.aiConfig,
    assigned.reviewer,
    aiState.dynamicModels[reviewerProvider] || [],
  );
  return useReviewStore.getState().startForSession(
    sessionId,
    config,
    config.provider !== 'ollama',
    { id: assigned.reviewer.id, name: assigned.reviewer.name },
  );
}

export async function reReviewAssignedSession(sessionId: string): Promise<void> {
  if (Object.values(useReviewStore.getState().activeRuns).some((run) => run.sessionId === sessionId && run.status === 'running')) {
    queuedReReviewSessions.add(sessionId);
    return;
  }
  if (isReviewStartingForSession(sessionId)) {
    queuedReReviewSessions.add(sessionId);
    return;
  }
  try {
    const run = await startAssignedReviewForSession(sessionId);
    if (!run && (isReviewStartingForSession(sessionId) || Object.values(useReviewStore.getState().activeRuns).some((item) => item.sessionId === sessionId && item.status === 'running'))) {
      queuedReReviewSessions.add(sessionId);
    }
  } catch (error) {
    queuedReReviewSessions.delete(sessionId);
    useGitStore.getState().showToast(`AI reviewer could not start: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function flushQueuedReReviewAfterActive(sessionId: string): Promise<void> {
  if (!queuedReReviewSessions.delete(sessionId)) return;
  await reReviewAssignedSession(sessionId);
}

export async function reviewAssignedSessionAfterGitChange(repoPath: string): Promise<void> {
  const virtualMr = useVirtualMrStore.getState();
  const session = virtualMr.getActiveSession();
  if (!session || virtualMr.currentRepoPath !== repoPath || session.status !== 'open' || !session.reviewers.length || checkingSession.has(session.id)) return;
  checkingSession.add(session.id);
  try {
    const [baseSha, headSha] = await Promise.all([
      invoke<string>('get_git_ref_sha', { repoPath, reference: session.baseBranch }),
      invoke<string>('get_git_ref_sha', { repoPath, reference: session.compareBranch }),
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
    const runs = await invoke<ReviewRun[]>('list_ai_reviews', { sessionId: session.id });
    const latestRun = [...runs].sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0];
    if (latestRun?.snapshot.headSha === headSha && latestRun.snapshot.baseSha === baseSha) {
      attemptedHeadBySession.set(session.id, revisionKey);
      return;
    }
    attemptedHeadBySession.set(session.id, revisionKey);
    const started = await startAssignedReviewForSession(session.id);
    if (!started && (isReviewStartingForSession(session.id) || Object.values(useReviewStore.getState().activeRuns).some((run) => run.sessionId === session.id && run.status === 'running'))) {
      queuedReReviewSessions.add(session.id);
    }
  } catch (error) {
    queuedReReviewSessions.delete(session.id);
    useGitStore.getState().showToast(`AI reviewer could not check the updated Virtual MR: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    checkingSession.delete(session.id);
  }
}
