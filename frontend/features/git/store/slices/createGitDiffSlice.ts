import { getApplicationServices } from '../../../../core/services/runtime/applicationRuntime';

import type { StateCreator } from 'zustand';
import { getErrorMessage, gitDiffRequests } from '../../services/gitStoreEffects';
import { type ChangedFile } from '../../types/ChangedFile';
import { type ConflictReport } from '../../types/ConflictReport';
import type { GitState } from '../../types/GitState';
import { type ViewMode } from '../../types/ViewMode';
import { createGitFileSelectionActions } from './createGitFileSelectionActions';

export const createGitDiffSlice: StateCreator<
  GitState,
  [],
  [],
  Pick<
    GitState,
    | 'branches'
    | 'baseBranch'
    | 'compareBranch'
    | 'diffPayload'
    | 'conflictReport'
    | 'diffError'
    | 'conflictCheckError'
    | 'selectedFile'
    | 'viewMode'
    | 'fileListLayout'
    | 'isDiffLoading'
    | 'fetchBranches'
    | 'setBaseBranch'
    | 'setCompareBranch'
    | 'setBranchComparison'
    | 'swapBranches'
    | 'loadDiff'
    | 'refreshDiff'
    | 'selectFile'
    | 'selectNextFile'
    | 'selectPrevFile'
    | 'selectNextConflictFile'
    | 'selectPrevConflictFile'
    | 'setFileListLayout'
    | 'setViewMode'
  >
> = (set, get) => ({
  branches: null,

  baseBranch: '',

  compareBranch: '',

  diffPayload: null,

  conflictReport: null,

  diffError: null,

  conflictCheckError: null,

  selectedFile: null,

  viewMode: 'split',

  fileListLayout: 'flat',

  isDiffLoading: false,

  fetchBranches: async (repoPath: string) => {
    try {
      const branches = await getApplicationServices().gitRepositories.getBranches({ repoPath });
      if (get().currentRepo?.local_path !== repoPath) return;

      // Smart default base branch (check local then remote)
      let base = 'main';
      if (branches.local.includes('main')) {
        base = 'main';
      } else if (branches.remote.includes('origin/main')) {
        base = 'origin/main';
      } else if (branches.local.includes('master')) {
        base = 'master';
      } else if (branches.remote.includes('origin/master')) {
        base = 'origin/master';
      } else {
        const remoteDefault = branches.remote.find(
          (b) => b.endsWith('/main') || b.endsWith('/master')
        );
        if (remoteDefault) {
          base = remoteDefault;
        } else if (branches.local.length > 0) {
          base = branches.local[0];
        } else if (branches.remote.length > 0) {
          base = branches.remote[0];
        } else {
          base = 'HEAD';
        }
      }

      let compare = branches.current || base;
      if (compare === base) {
        const otherLocal = branches.local.find((b) => b !== base);
        if (otherLocal) {
          compare = otherLocal;
        } else {
          const otherRemote = branches.remote.find((b) => b !== base);
          if (otherRemote) {
            compare = otherRemote;
          }
        }
      }

      set({
        branches,
        baseBranch: base,
        compareBranch: compare,
      });

      // Also refresh remotes in background
      get().fetchRemotes(repoPath);

      await get().loadDiff();
    } catch (err: unknown) {
      set({ error: String(err) });
    }
  },

  setBaseBranch: async (branch: string) => {
    set({ baseBranch: branch });
    await get().loadDiff();
  },

  setCompareBranch: async (branch: string) => {
    set({ compareBranch: branch });
    await get().loadDiff();
  },

  setBranchComparison: async (base: string, compare: string) => {
    set({ baseBranch: base, compareBranch: compare });
    await get().loadDiff();
  },

  swapBranches: async () => {
    const { baseBranch, compareBranch } = get();
    set({ baseBranch: compareBranch, compareBranch: baseBranch });
    await get().loadDiff();
  },

  loadDiff: async () => {
    const { currentRepo, baseBranch, compareBranch } = get();
    const requestVersion = ++gitDiffRequests.version;
    if (!currentRepo || !baseBranch || !compareBranch) {
      set({
        isDiffLoading: false,
        diffPayload: null,
        conflictReport: null,
        diffError: null,
        conflictCheckError: null,
        selectedFile: null,
      });
      return;
    }

    const repoPath = currentRepo.local_path;
    const selectedPath = get().selectedFile?.path;
    const isCurrentRequest = () => {
      const current = get();
      return (
        requestVersion === gitDiffRequests.version &&
        current.currentRepo?.local_path === repoPath &&
        current.baseBranch === baseBranch &&
        current.compareBranch === compareBranch
      );
    };

    set({
      isDiffLoading: true,
      error: null,
      diffError: null,
      conflictCheckError: null,
      diffPayload: null,
      conflictReport: null,
      selectedFile: null,
    });
    try {
      const diffPayload = await getApplicationServices().gitHistory.getMrDiff({
        repoPath,
        base: baseBranch,
        compare: compareBranch,
      });
      if (!isCurrentRequest()) return;

      let conflictReport: ConflictReport | null = null;
      let conflictCheckError: string | null = null;
      try {
        conflictReport = await getApplicationServices().gitHistory.checkMergeConflicts({
          repoPath,
          base: baseBranch,
          compare: compareBranch,
        });
      } catch (err: unknown) {
        conflictCheckError = getErrorMessage(err);
      }
      if (!isCurrentRequest()) return;

      let nextSelected: ChangedFile | null = null;

      if (diffPayload.files.length > 0) {
        nextSelected =
          diffPayload.files.find((f) => f.path === selectedPath) || diffPayload.files[0];
      }

      set({
        diffPayload,
        conflictReport,
        diffError: null,
        conflictCheckError,
        selectedFile: nextSelected,
        ...(nextSelected?.is_binary && get().fileViewTab !== 'diff'
          ? { fileViewTab: 'diff' as const }
          : {}),
      });
      get().checkRebaseStatus(repoPath);
    } catch (err: unknown) {
      if (isCurrentRequest()) {
        set({
          diffPayload: null,
          conflictReport: null,
          diffError: getErrorMessage(err),
          conflictCheckError: null,
          selectedFile: null,
        });
      }
    } finally {
      if (isCurrentRequest()) set({ isDiffLoading: false });
    }
  },

  refreshDiff: async () => get().loadDiff(),

  ...createGitFileSelectionActions(set, get),

  setFileListLayout: (layout: 'flat' | 'tree') => {
    set({ fileListLayout: layout });
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },
});
