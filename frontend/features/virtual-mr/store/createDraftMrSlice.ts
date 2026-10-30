import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import i18n from '../../i18n/i18n';

import { useGitStore } from '../../git/store/useGitStore';
import { type NewMrDraft } from '../types/NewMrDraft';
import { type VirtualMrCommit } from '../types/VirtualMrCommit';
import type { VirtualMrState } from '../types/VirtualMrState';
import { getErrorMessage } from '../utils/virtualMrSessionHelpers';
import { createDraftSubmissionActions } from './createDraftSubmissionActions';

let draftBranchRequestVersion = 0;

export const createDraftMrSlice = (
  set: (
    partial: Partial<VirtualMrState> | ((state: VirtualMrState) => Partial<VirtualMrState>)
  ) => void,
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
      useGitStore.getState().showToast(i18n.t('virtualMr.toasts.noActiveRepository'));
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
    const base =
      initialBase || repoSettings?.defaultBaseBranch || gitStore.baseBranch || smartFallback;
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
      const raw = await getApplicationServices().gitHistory.getCommitsBetweenRefs({
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
        if (
          !state.draftMr ||
          state.draftMr.baseBranch !== base ||
          state.draftMr.compareBranch !== compare
        )
          return {};
        const title =
          commits.length > 0 && commits[0].subject ? commits[0].subject : `${compare} → ${base}`;
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
      const raw = await getApplicationServices().gitHistory.getCommitsBetweenRefs({
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
        if (
          !state.draftMr ||
          state.draftMr.baseBranch !== base ||
          state.draftMr.compareBranch !== compare
        )
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

  ...createDraftSubmissionActions(set, get),
});
