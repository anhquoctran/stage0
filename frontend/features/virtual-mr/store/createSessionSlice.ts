import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

import { useGitStore } from '../../git/store/useGitStore';
import { type VirtualMrCommit } from '../types/VirtualMrCommit';
import type { VirtualMrState } from '../types/VirtualMrState';
import { type VirtualMrStatus } from '../types/VirtualMrStatus';
import { hasVirtualMrActivity } from '../utils/virtualMrActivity';
import {
openExistingVirtualMr,
persistSession,
updateSessionMetadata,
} from '../utils/virtualMrSessionHelpers';
import { createSessionReviewerActions } from './createSessionReviewerActions';
import { recordSessionTitleChange } from '../utils/virtualMrTitleHistory';

export const createSessionSlice = (
  set: (
    partial: Partial<VirtualMrState> | ((state: VirtualMrState) => Partial<VirtualMrState>)
  ) => void,
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

    set({
      closedSessionTabIds: closedTabs,
      activeSessionId: nextActive,
      isDraftActive: nextDraftActive,
    });

    if (nextDraftActive && draftMr) {
      get().activateDraftMr();
    } else if (nextActive) {
      const nextSession = sessions.find((s) => s.id === nextActive);
      if (nextSession) {
        useGitStore
          .getState()
          .setBranchComparison(nextSession.baseBranch, nextSession.compareBranch);
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

  ...createSessionReviewerActions(set, get),

  updateSessionDetails: async (sessionId: string, title: string, description: string) => {
    const { sessions, currentRepoId } = get();
    const updated = sessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            title,
            description,
            titleHistory:
              s.title !== title
                ? recordSessionTitleChange(sessionId, s.title, title, s.assignee.name)
                : s.titleHistory,
            updatedAt: new Date().toISOString(),
            descriptionUpdatedAt:
              s.description !== description ? new Date().toISOString() : s.descriptionUpdatedAt,
          }
        : s
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
          ? {
              ...session,
              description,
              updatedAt: new Date().toISOString(),
              descriptionUpdatedAt: new Date().toISOString(),
            }
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
        const raw = await getApplicationServices().gitHistory.getCommitsBetweenRefs({
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
