import type { StoreApi } from 'zustand';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { type ReviewerState } from '../types/ReviewerState';
import { type VirtualMrReviewer } from '../types/VirtualMrReviewer';
import type { VirtualMrState } from '../types/VirtualMrState';
import { AVAILABLE_AI_BOTS } from '../types/virtualMr';
import { isResolvableDiscussion } from '../utils/discussionResolvable';
import { updateSessionMetadata } from '../utils/virtualMrSessionHelpers';
export const createSessionReviewerActions = (
  set: StoreApi<VirtualMrState>['setState'],
  get: StoreApi<VirtualMrState>['getState']
): Pick<
  VirtualMrState,
  | 'setReviewerReviewStatus'
  | 'resetReviewerReviews'
  | 'invalidateReviewerApprovals'
  | 'tryResolveSession'
  | 'assignReviewerBot'
  | 'removeReviewerBot'
> => ({
  setReviewerReviewStatus: async (
    sessionId: string,
    agentId: string,
    reviewStatus: ReviewerState
  ) => {
    await updateSessionMetadata(
      sessionId,
      (session) => {
        const current = session.reviewers.find((reviewer) => reviewer.agentId === agentId);
        if (!current) return null;
        const reviewers = session.reviewers.map((reviewer) =>
          reviewer.agentId === agentId ? { ...reviewer, reviewStatus } : reviewer
        );
        const allReviewersApproved =
          reviewers.length > 0 &&
          reviewers.every((reviewer) => reviewer.reviewStatus === 'approved');
        const hasOpenDiscussions = session.discussions.some(
          (discussion) => isResolvableDiscussion(discussion) && !discussion.isResolved
        );
        const status =
          reviewStatus === 'reviewing'
            ? session.status === 'resolved'
              ? 'open'
              : session.status
            : session.status === 'closed'
              ? 'closed'
              : allReviewersApproved && !hasOpenDiscussions
                ? 'resolved'
                : 'open';
        if (current.reviewStatus === reviewStatus && session.status === status) return null;
        return { reviewers, status };
      },
      get,
      set
    );
  },

  resetReviewerReviews: async (sessionId: string) => {
    await updateSessionMetadata(
      sessionId,
      (session) => ({
        status: 'open',
        reviewers: session.reviewers.map((reviewer) => ({ ...reviewer, reviewStatus: 'pending' })),
      }),
      get,
      set
    );
  },

  invalidateReviewerApprovals: async (sessionId: string) => {
    await updateSessionMetadata(
      sessionId,
      (session) => {
        const status = session.status === 'resolved' ? 'open' : session.status;
        if (
          session.reviewers.every((reviewer) => reviewer.reviewStatus === 'pending') &&
          session.status === status
        )
          return null;
        return {
          status,
          reviewers: session.reviewers.map((reviewer) => ({
            ...reviewer,
            reviewStatus: 'pending',
          })),
        };
      },
      get,
      set
    );
  },

  tryResolveSession: async (sessionId: string) => {
    const session = get().sessions.find((item) => item.id === sessionId);
    if (!session || session.status !== 'open' || session.reviewers.length === 0) return;
    if (session.reviewers.some((reviewer) => reviewer.reviewStatus !== 'approved')) return;
    if (
      session.discussions.some(
        (discussion) => isResolvableDiscussion(discussion) && !discussion.isResolved
      )
    )
      return;
    await get().updateSessionStatus(sessionId, 'resolved');
  },

  assignReviewerBot: async (sessionId: string, botId: string) => {
    const { currentRepoId } = get();
    const allBots = [
      ...useBotReviewersStore.getState().globalReviewers,
      ...(currentRepoId
        ? useBotReviewersStore.getState().repoCustomReviewers[currentRepoId] || []
        : []),
    ];
    const bot =
      allBots.find((b) => b.id === botId) || AVAILABLE_AI_BOTS.find((b) => b.id === botId);
    if (!bot) return;

    await updateSessionMetadata(
      sessionId,
      (session) => {
        if (session.reviewers.some((r) => r.agentId === botId)) return null;
        const newReviewer: VirtualMrReviewer = {
          agentId: bot.id,
          agentName: bot.name,
          reviewStatus: 'pending',
          assignedAt: new Date().toISOString(),
        };
        return {
          status: session.status === 'closed' ? 'closed' : 'open',
          reviewers: [
            ...session.reviewers.map((reviewer) => ({
              ...reviewer,
              reviewStatus: 'pending' as const,
            })),
            newReviewer,
          ],
        };
      },
      get,
      set
    );
    void import('../../review/services/assignedReviewService').then(({ reReviewAssignedSession }) =>
      reReviewAssignedSession(sessionId)
    );
  },

  removeReviewerBot: async (sessionId: string, agentId: string) => {
    await updateSessionMetadata(
      sessionId,
      (session) => {
        if (!session.reviewers.some((reviewer) => reviewer.agentId === agentId)) return null;
        return {
          status: session.status === 'closed' ? 'closed' : 'open',
          reviewers: session.reviewers
            .filter((reviewer) => reviewer.agentId !== agentId)
            .map((reviewer) => ({ ...reviewer, reviewStatus: 'pending' as const })),
        };
      },
      get,
      set
    );
    void import('../../review/services/assignedReviewService').then(({ reReviewAssignedSession }) =>
      reReviewAssignedSession(sessionId)
    );
  },
});
