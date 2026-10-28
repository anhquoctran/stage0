import type { StoreApi } from 'zustand';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { useGitStore } from '../../git/store/useGitStore';
import { type VirtualMrSession } from '../types/VirtualMrSession';
import type { VirtualMrState } from '../types/VirtualMrState';
import { AVAILABLE_AI_BOTS } from '../types/virtualMr';
import { openExistingVirtualMr,persistSession } from '../utils/virtualMrSessionHelpers';
import { loadLocalGitAuthor } from '../services/loadLocalGitAuthor';
export const createDraftSubmissionActions = (
  set: StoreApi<VirtualMrState>['setState'],
  get: StoreApi<VirtualMrState>['getState']
): Pick<VirtualMrState, 'submitNewMrDraft'> => ({
  submitNewMrDraft: async () => {
    const { draftMr, currentRepoId, currentRepoPath, repoLabels, sessions } = get();
    if (!draftMr || !currentRepoId || !currentRepoPath) return '';

    const newId = `vmr-${Date.now()}`;
    const title = draftMr.title.trim() || `${draftMr.compareBranch} → ${draftMr.baseBranch}`;

    const newSession: VirtualMrSession = {
      id: newId,
      repoId: currentRepoId,
      title,
      description: draftMr.description,
      baseBranch: draftMr.baseBranch,
      compareBranch: draftMr.compareBranch,
      status: 'open',
      assignee: await loadLocalGitAuthor(currentRepoPath, sessions[0]?.assignee),
      reviewers: (() => {
        const repoId = currentRepoId;
        const allBots = [
          ...useBotReviewersStore.getState().globalReviewers,
          ...(repoId ? useBotReviewersStore.getState().repoCustomReviewers[repoId] || [] : []),
        ];
        return draftMr.selectedBots.map((botId) => {
          const bot =
            allBots.find((b) => b.id === botId) || AVAILABLE_AI_BOTS.find((b) => b.id === botId);
          return {
            agentId: botId,
            agentName: bot?.name || botId,
            reviewStatus: 'pending' as const,
            assignedAt: new Date().toISOString(),
          };
        });
      })(),
      labels: (repoLabels || []).filter((l) => draftMr.selectedLabels.includes(l.id)),
      discussions: [],
      commits: draftMr.commits,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const outcome = await persistSession(newSession, get);
      if (outcome.outcome === 'duplicate_open') {
        openExistingVirtualMr(outcome, get);
        return '';
      }
    } catch (err) {
      console.error('Failed to save virtual MR to database:', err);
      useGitStore
        .getState()
        .showToast(
          'Could not save this Virtual MR to the database. Your draft is still available; please try again.'
        );
      return '';
    }

    const currentState = get();
    if (currentState.currentRepoId !== currentRepoId) return newId;
    set({
      sessions: [...currentState.sessions, newSession],
      activeSessionId: newId,
      pendingDescriptionEditSessionId: newId,
      closedSessionTabIds: currentState.closedSessionTabIds.filter((id) => id !== newId),
      draftMr: null,
      isDraftActive: false,
    });

    useGitStore.getState().showToast(`Created Virtual MR: ${title}`);
    return newId;
  },
});
