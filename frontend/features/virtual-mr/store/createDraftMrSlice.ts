import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../../git/store/useGitStore';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { type NewMrDraft } from '../types/NewMrDraft';
import { type VirtualMrSession } from '../types/VirtualMrSession';
import { type VirtualMrCommit } from '../types/VirtualMrCommit';
import { AVAILABLE_AI_BOTS } from '../types/virtualMr';
import {
  persistSession,
  openExistingVirtualMr,
  getErrorMessage,
} from '../utils/virtualMrSessionHelpers';
import type { VirtualMrState } from '../types/VirtualMrState';

let draftBranchRequestVersion = 0;

export const createDraftMrSlice = (
  set: (partial: Partial<VirtualMrState> | ((state: VirtualMrState) => Partial<VirtualMrState>)) => void,
  get: () => VirtualMrState
) => ({
  openNewMrDraft: async (initialBase?: string, initialCompare?: string) => {
    const requestVersion = ++draftBranchRequestVersion;
    let { currentRepoId, currentRepoPath, repoSettings } = get();

    if (!currentRepoId || !currentRepoPath) {
      const gitStore = useGitStore.getState();
      if (gitStore.currentRepo) {
        currentRepoId = gitStore.currentRepo.id;
        currentRepoPath = gitStore.currentRepo.local_path;
        set({ currentRepoId, currentRepoPath });
      }
    }

    if (!currentRepoPath) {
      useGitStore.getState().showToast('No active repository to create Virtual MR');
      return;
    }

    const gitStore = useGitStore.getState();
    const availableBranches = [
      ...(gitStore.branches?.local || []),
      ...(gitStore.branches?.remote || []),
    ];
    const smartFallback =
      (availableBranches.includes('main') ? 'main' : undefined) ||
      (availableBranches.includes('origin/main') ? 'origin/main' : undefined) ||
      (availableBranches.includes('master') ? 'master' : undefined) ||
      (availableBranches.includes('origin/master') ? 'origin/master' : undefined) ||
      availableBranches[0] ||
      'HEAD';
    const base = initialBase || repoSettings?.defaultBaseBranch || gitStore.baseBranch || smartFallback;
    const compare =
      initialCompare ||
      gitStore.compareBranch ||
      availableBranches.find((b: string) => b !== base) ||
      base;

    const newDraft: NewMrDraft = {
      baseBranch: base,
      compareBranch: compare,
      title: `${compare} → ${base}`,
      description: '',
      selectedBots: [],
      selectedLabels: [],
      commits: [],
      isCommitsLoading: true,
      commitsError: null,
    };

    set({ draftMr: newDraft, isDraftActive: true, activeSessionId: null });

    // Sync with gitStore so diff immediately loads
    try {
      await gitStore.setBranchComparison(base, compare);
    } catch {}

    const isCurrentDraftRequest = () => {
      const currentDraft = get().draftMr;
      return (
        requestVersion === draftBranchRequestVersion &&
        currentDraft?.baseBranch === base &&
        currentDraft.compareBranch === compare
      );
    };
    if (!isCurrentDraftRequest()) return;

    // Load commits
    try {
      const raw = await invoke<any[]>('get_commits_between_refs', {
        repoPath: currentRepoPath,
        base,
        compare,
      });
      const commits: VirtualMrCommit[] = (raw || []).map((c) => ({
        hash: c.hash,
        shortHash: c.short_hash,
        subject: c.subject,
        body: c.body,
        authorName: c.author_name,
        authorEmail: c.author_email,
        authoredDate: c.authored_date,
      }));

      if (!isCurrentDraftRequest()) return;
      set((state) => {
        if (!state.draftMr || state.draftMr.baseBranch !== base || state.draftMr.compareBranch !== compare)
          return {};
        const title = commits.length > 0 && commits[0].subject ? commits[0].subject : `${compare} → ${base}`;
        return {
          draftMr: {
            ...state.draftMr,
            commits,
            title,
            isCommitsLoading: false,
          },
        };
      });
    } catch (error: unknown) {
      if (!isCurrentDraftRequest()) return;
      set((state) =>
        state.draftMr
          ? {
              draftMr: {
                ...state.draftMr,
                isCommitsLoading: false,
                commitsError: getErrorMessage(error),
              },
            }
          : {}
      );
    }
  },

  updateDraftMr: (updates: Partial<NewMrDraft>) => {
    set((state) => (state.draftMr ? { draftMr: { ...state.draftMr, ...updates } } : {}));
  },

  changeDraftBranches: async (base: string, compare: string) => {
    const { currentRepoPath, draftMr } = get();
    if (!draftMr || !currentRepoPath) return;
    const requestVersion = ++draftBranchRequestVersion;
    const hadDefaultTitle = draftMr.title === `${draftMr.compareBranch} → ${draftMr.baseBranch}`;
    const isCurrentDraftRequest = () => {
      const currentDraft = get().draftMr;
      return (
        requestVersion === draftBranchRequestVersion &&
        currentDraft?.baseBranch === base &&
        currentDraft.compareBranch === compare
      );
    };

    set((state) => ({
      draftMr: state.draftMr
        ? {
            ...state.draftMr,
            baseBranch: base,
            compareBranch: compare,
            commits: [],
            isCommitsLoading: true,
            commitsError: null,
          }
        : null,
    }));

    const gitStore = useGitStore.getState();
    try {
      await gitStore.setBranchComparison(base, compare);
    } catch {}
    if (!isCurrentDraftRequest()) return;

    try {
      const raw = await invoke<any[]>('get_commits_between_refs', {
        repoPath: currentRepoPath,
        base,
        compare,
      });
      const commits: VirtualMrCommit[] = (raw || []).map((c) => ({
        hash: c.hash,
        shortHash: c.short_hash,
        subject: c.subject,
        body: c.body,
        authorName: c.author_name,
        authorEmail: c.author_email,
        authoredDate: c.authored_date,
      }));

      if (!isCurrentDraftRequest()) return;
      set((state) => {
        if (!state.draftMr || state.draftMr.baseBranch !== base || state.draftMr.compareBranch !== compare)
          return {};
        const defaultTitle =
          commits.length > 0 && commits[0].subject ? commits[0].subject : `${compare} → ${base}`;
        return {
          draftMr: {
            ...state.draftMr,
            commits,
            title: hadDefaultTitle ? defaultTitle : state.draftMr.title,
            isCommitsLoading: false,
            commitsError: null,
          },
        };
      });
    } catch (error: unknown) {
      if (!isCurrentDraftRequest()) return;
      set((state) =>
        state.draftMr
          ? {
              draftMr: {
                ...state.draftMr,
                isCommitsLoading: false,
                commitsError: getErrorMessage(error),
              },
            }
          : {}
      );
    }
  },

  closeNewMrDraft: () => {
    draftBranchRequestVersion += 1;
    const { sessions } = get();
    set({ draftMr: null, isDraftActive: false });
    if (sessions.length > 0) {
      const target = sessions[0];
      set({ activeSessionId: target.id });
      const gitStore = useGitStore.getState();
      gitStore.setBranchComparison(target.baseBranch, target.compareBranch);
    }
  },

  openMrListView: () => {
    set({ activeSessionId: null, isDraftActive: false, isMrListOpen: false });
  },

  activateDraftMr: () => {
    const { draftMr } = get();
    set({ isDraftActive: true, activeSessionId: null });
    if (draftMr) {
      const gitStore = useGitStore.getState();
      gitStore.setBranchComparison(draftMr.baseBranch, draftMr.compareBranch);
    }
  },

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
      assignee: sessions[0]?.assignee || { name: 'Local User', email: 'user@local.stage0' },
      reviewers: (() => {
        const repoId = currentRepoId;
        const allBots = [
          ...useBotReviewersStore.getState().globalReviewers,
          ...(repoId ? useBotReviewersStore.getState().repoCustomReviewers[repoId] || [] : []),
        ];
        return draftMr.selectedBots.map((botId) => {
          const bot = allBots.find((b) => b.id === botId) || AVAILABLE_AI_BOTS.find((b) => b.id === botId);
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

