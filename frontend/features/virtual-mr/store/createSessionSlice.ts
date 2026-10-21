import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../../git/store/useGitStore';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { type ReviewerState } from '../types/ReviewerState';
import { type VirtualMrReviewer } from '../types/VirtualMrReviewer';
import { type VirtualMrCommit } from '../types/VirtualMrCommit';
import { type VirtualMrStatus } from '../types/VirtualMrStatus';
import { AVAILABLE_AI_BOTS } from '../types/virtualMr';
import { hasVirtualMrActivity } from '../utils/virtualMrActivity';
import { isResolvableDiscussion } from '../utils/discussionResolvable';
import {
  persistSession,
  updateSessionMetadata,
  openExistingVirtualMr,
} from '../utils/virtualMrSessionHelpers';
import type { VirtualMrState } from '../types/VirtualMrState';

export const createSessionSlice = (
  set: (partial: Partial<VirtualMrState> | ((state: VirtualMrState) => Partial<VirtualMrState>)) => void,
  get: () => VirtualMrState
) => ({
  switchSession: (sessionId: string) => {
    set((state) => ({
      activeSessionId: sessionId,
      isDraftActive: false,
      closedSessionTabIds: state.closedSessionTabIds.filter((id) => id !== sessionId),
    }));
  },

  closeSession: async (sessionId: string) => {
    const { sessions, activeSessionId, draftMr, isDraftActive, closedSessionTabIds } = get();
    if (!sessions.some((session) => session.id === sessionId)) return;

    const closedTabs = [...new Set([...closedSessionTabIds, sessionId])];
    const remainingTabs = sessions.filter((session) => !closedTabs.includes(session.id));
    let nextActive = activeSessionId;
    let nextDraftActive = isDraftActive;

    if (!isDraftActive && activeSessionId === sessionId) {
      if (remainingTabs.length > 0) {
        nextActive = remainingTabs[0].id;
      } else if (draftMr) {
        nextActive = null;
        nextDraftActive = true;
      } else {
        nextActive = null;
      }
    }

    set({ closedSessionTabIds: closedTabs, activeSessionId: nextActive, isDraftActive: nextDraftActive });

    if (nextDraftActive && draftMr) {
      get().activateDraftMr();
    } else if (nextActive) {
      const nextSession = sessions.find((s) => s.id === nextActive);
      if (nextSession) {
        useGitStore.getState().setBranchComparison(nextSession.baseBranch, nextSession.compareBranch);
      }
    }
  },

  updateSessionStatus: async (sessionId: string, status: VirtualMrStatus) => {
    const { sessions, currentRepoId } = get();
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, status, updatedAt: new Date().toISOString() } : s
    );
    set({ sessions: updated });

    const target = updated.find((s) => s.id === sessionId);
    if (target && currentRepoId) {
      try {
        const outcome = await persistSession(target, get);
        if (outcome.outcome === 'duplicate_open') {
          set({ sessions });
          openExistingVirtualMr(outcome, get);
        }
      } catch {}
    }
  },

  setReviewerReviewStatus: async (sessionId: string, agentId: string, reviewStatus: ReviewerState) => {
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
          reviewers: session.reviewers.map((reviewer) => ({ ...reviewer, reviewStatus: 'pending' })),
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
    if (session.discussions.some((discussion) => isResolvableDiscussion(discussion) && !discussion.isResolved))
      return;
    await get().updateSessionStatus(sessionId, 'resolved');
  },

  updateSessionDetails: async (sessionId: string, title: string, description: string) => {
    const { sessions, currentRepoId } = get();
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, title, description, updatedAt: new Date().toISOString() } : s
    );
    set({ sessions: updated });

    const target = updated.find((s) => s.id === sessionId);
    if (target && currentRepoId) {
      try {
        const outcome = await persistSession(target, get);
        if (outcome.outcome === 'duplicate_open') {
          set({ sessions });
          openExistingVirtualMr(outcome, get);
        }
      } catch {}
    }
  },

  applyReviewGeneratedDescription: async (sessionId: string, description: string) => {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId && session.description !== description
          ? { ...session, description, updatedAt: new Date().toISOString() }
          : session
      ),
    }));
  },

  updateSessionBranches: async (sessionId: string, base: string, compare: string) => {
    const targetSession = get().sessions.find((s) => s.id === sessionId);
    if (!targetSession) return;

    const isActivityPresent =
      typeof hasVirtualMrActivity === 'function'
        ? hasVirtualMrActivity(targetSession)
        : Boolean(
            targetSession.discussions?.length ||
              targetSession.reviewers?.some((r) => r.reviewStatus && r.reviewStatus !== 'pending')
          );

    if (isActivityPresent) {
      useGitStore
        .getState()
        .showToast(
          'Cannot change branches after discussions or reviews have started in this Virtual MR',
          'warning'
        );
      return;
    }
    const { currentRepoPath } = get();
    let commits: VirtualMrCommit[] = [];
    if (currentRepoPath) {
      try {
        const raw = await invoke<any[]>('get_commits_between_refs', {
          repoPath: currentRepoPath,
          base,
          compare,
        });
        commits = (raw || []).map((c) => ({
          hash: c.hash,
          shortHash: c.short_hash,
          subject: c.subject,
          body: c.body,
          authorName: c.author_name,
          authorEmail: c.author_email,
          authoredDate: c.authored_date,
        }));
      } catch {}
    }

    const previousSessions = get().sessions;
    const updated = previousSessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            baseBranch: base,
            compareBranch: compare,
            title: `${compare} → ${base}`,
            status: (s.status === 'closed' ? 'closed' : 'open') as VirtualMrStatus,
            reviewers: s.reviewers.map((reviewer) => ({
              ...reviewer,
              reviewStatus: 'pending' as const,
            })),
            commits,
            updatedAt: new Date().toISOString(),
          }
        : s
    );
    set({ sessions: updated });

    const target = updated.find((s) => s.id === sessionId);
    const { currentRepoId } = get();
    if (target && currentRepoId) {
      try {
        const outcome = await persistSession(target, get);
        if (outcome.outcome === 'duplicate_open') {
          set({ sessions: previousSessions });
          openExistingVirtualMr(outcome, get);
        }
      } catch (err) {
        console.warn('Failed to persist session branch changes:', err);
      }
    }
  },

  assignReviewerBot: async (sessionId: string, botId: string) => {
    const { currentRepoId } = get();
    const allBots = [
      ...useBotReviewersStore.getState().globalReviewers,
      ...(currentRepoId
        ? useBotReviewersStore.getState().repoCustomReviewers[currentRepoId] || []
        : []),
    ];
    const bot = allBots.find((b) => b.id === botId) || AVAILABLE_AI_BOTS.find((b) => b.id === botId);
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
    void import('../../review/services/assignedReviewService').then(
      ({ reReviewAssignedSession }) => reReviewAssignedSession(sessionId)
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
    void import('../../review/services/assignedReviewService').then(
      ({ reReviewAssignedSession }) => reReviewAssignedSession(sessionId)
    );
  },

  toggleSessionLabel: async (sessionId: string, labelId: string) => {
    const { repoLabels } = get();
    const targetLabel = repoLabels.find((l) => l.id === labelId);
    if (!targetLabel) return;

    await updateSessionMetadata(
      sessionId,
      (session) => {
        if (session.repoId !== targetLabel.repoId) return null;
        const has = session.labels.some((label) => label.id === labelId);
        return {
          labels: has
            ? session.labels.filter((label) => label.id !== labelId)
            : [...session.labels, targetLabel],
        };
      },
      get,
      set
    );
  },
});

