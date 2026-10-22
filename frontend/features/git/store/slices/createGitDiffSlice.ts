import { invoke } from '@tauri-apps/api/core';
import type { StateCreator } from 'zustand';
import { getErrorMessage, gitDiffRequests } from '../../services/gitStoreEffects';
import { type BranchList } from '../../types/BranchList';
import { type ChangedFile } from '../../types/ChangedFile';
import { type ConflictReport } from '../../types/ConflictReport';
import type { GitState } from '../../types/GitState';
import { type MrDiffPayload } from '../../types/MrDiffPayload';
import { type ViewMode } from '../../types/ViewMode';

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
      const branches = await invoke<BranchList>('get_branches', { repoPath });
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
      const diffPayload = await invoke<MrDiffPayload>('get_mr_diff', {
        repoPath,
        base: baseBranch,
        compare: compareBranch,
      });
      if (!isCurrentRequest()) return;

      let conflictReport: ConflictReport | null = null;
      let conflictCheckError: string | null = null;
      try {
        conflictReport = await invoke<ConflictReport>('check_merge_conflicts', {
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

  selectFile: (file: ChangedFile | null) => {
    set({
      selectedFile: file,
      activeConflictPreview: null,
      ...(file?.is_binary && get().fileViewTab !== 'diff' ? { fileViewTab: 'diff' as const } : {}),
    });
    if (file) {
      if (file.is_conflicted && !file.is_binary) {
        get().fetchConflictPreview(file.path);
      }
      if (get().fileViewTab === 'blame' && !file.is_binary) {
        get().fetchFileBlame(file.path);
      }
    }
  },

  selectNextFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    if (!selectedFile) {
      const first = diffPayload.files[0];
      set({
        selectedFile: first,
        ...(first.is_binary && get().fileViewTab !== 'diff'
          ? { fileViewTab: 'diff' as const }
          : {}),
      });
      if (get().fileViewTab === 'blame' && !first.is_binary) {
        get().fetchFileBlame(first.path);
      }
      return;
    }
    const idx = diffPayload.files.findIndex((f) => f.path === selectedFile.path);
    if (idx !== -1 && idx < diffPayload.files.length - 1) {
      const next = diffPayload.files[idx + 1];
      set({
        selectedFile: next,
        ...(next.is_binary && get().fileViewTab !== 'diff' ? { fileViewTab: 'diff' as const } : {}),
      });
      if (get().fileViewTab === 'blame' && !next.is_binary) {
        get().fetchFileBlame(next.path);
      }
    }
  },

  selectPrevFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    if (!selectedFile) {
      const first = diffPayload.files[0];
      set({
        selectedFile: first,
        ...(first.is_binary && get().fileViewTab !== 'diff'
          ? { fileViewTab: 'diff' as const }
          : {}),
      });
      if (get().fileViewTab === 'blame' && !first.is_binary) {
        get().fetchFileBlame(first.path);
      }
      return;
    }
    const idx = diffPayload.files.findIndex((f) => f.path === selectedFile.path);
    if (idx > 0) {
      const prev = diffPayload.files[idx - 1];
      set({
        selectedFile: prev,
        ...(prev.is_binary && get().fileViewTab !== 'diff' ? { fileViewTab: 'diff' as const } : {}),
      });
      if (get().fileViewTab === 'blame' && !prev.is_binary) {
        get().fetchFileBlame(prev.path);
      }
    }
  },

  selectNextConflictFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    const conflicted = diffPayload.files.filter((f) => f.is_conflicted && !f.is_binary);
    if (conflicted.length === 0) return;

    if (!selectedFile || !selectedFile.is_conflicted || selectedFile.is_binary) {
      get().selectFile(conflicted[0]);
      return;
    }

    const currentIdx = conflicted.findIndex((f) => f.path === selectedFile.path);
    const nextIdx = (currentIdx + 1) % conflicted.length;
    get().selectFile(conflicted[nextIdx]);
  },

  selectPrevConflictFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    const conflicted = diffPayload.files.filter((f) => f.is_conflicted && !f.is_binary);
    if (conflicted.length === 0) return;

    if (!selectedFile || !selectedFile.is_conflicted || selectedFile.is_binary) {
      get().selectFile(conflicted[conflicted.length - 1]);
      return;
    }

    const currentIdx = conflicted.findIndex((f) => f.path === selectedFile.path);
    const prevIdx = (currentIdx - 1 + conflicted.length) % conflicted.length;
    get().selectFile(conflicted[prevIdx]);
  },

  setFileListLayout: (layout: 'flat' | 'tree') => {
    set({ fileListLayout: layout });
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },
});
