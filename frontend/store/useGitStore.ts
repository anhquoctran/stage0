import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  BranchList,
  ChangedFile,
  ConflictReport,
  MrDiffPayload,
  RepoInfo,
  RepoValidation,
  ViewMode,
  GitSyncOperation,
  GitSyncOptions,
} from '../types/git';

interface GitState {
  currentRepo: RepoInfo | null;
  recentRepos: RepoInfo[];
  branches: BranchList | null;
  baseBranch: string;
  compareBranch: string;
  diffPayload: MrDiffPayload | null;
  conflictReport: ConflictReport | null;
  selectedFile: ChangedFile | null;
  viewMode: ViewMode;
  fileListLayout: 'flat' | 'tree';
  isInitializing: boolean;
  isLoading: boolean;
  isDiffLoading: boolean;
  isSyncing: boolean;
  syncStatus: string | null;
  error: string | null;

  initApp: () => Promise<void>;
  loadRecentRepos: () => Promise<void>;
  openRepoDialog: () => Promise<void>;
  selectRepo: (repo: RepoInfo) => Promise<void>;
  removeRecentRepo: (id: string) => Promise<void>;
  fetchBranches: (repoPath: string) => Promise<void>;
  setBaseBranch: (branch: string) => Promise<void>;
  setCompareBranch: (branch: string) => Promise<void>;
  swapBranches: () => Promise<void>;
  loadDiff: () => Promise<void>;
  refreshDiff: () => Promise<void>;
  selectFile: (file: ChangedFile | null) => void;
  selectNextFile: () => void;
  selectPrevFile: () => void;
  setViewMode: (mode: ViewMode) => void;
  setFileListLayout: (layout: 'flat' | 'tree') => void;
  remotes: string[];
  isPullFromOpen: boolean;
  isRebaseFromOpen: boolean;
  setIsPullFromOpen: (open: boolean) => void;
  setIsRebaseFromOpen: (open: boolean) => void;
  fetchRemotes: (repoPath: string) => Promise<void>;
  runSync: (op: GitSyncOperation, options?: GitSyncOptions) => Promise<void>;
  clearError: () => void;
  closeRepo: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  currentRepo: null,
  recentRepos: [],
  branches: null,
  remotes: [],
  isPullFromOpen: false,
  isRebaseFromOpen: false,
  setIsPullFromOpen: (open) => set({ isPullFromOpen: open }),
  setIsRebaseFromOpen: (open) => set({ isRebaseFromOpen: open }),
  baseBranch: '',
  compareBranch: '',
  diffPayload: null,
  conflictReport: null,
  selectedFile: null,
  viewMode: 'split',
  fileListLayout: 'flat',
  isInitializing: true,
  isLoading: false,
  isDiffLoading: false,
  isSyncing: false,
  syncStatus: null,
  error: null,

  clearError: () => set({ error: null, syncStatus: null }),

  closeRepo: () =>
    set({
      currentRepo: null,
      branches: null,
      baseBranch: '',
      compareBranch: '',
      diffPayload: null,
      conflictReport: null,
      selectedFile: null,
    }),

  initApp: async () => {
    set({ isInitializing: true });
    try {
      const repos = await invoke<RepoInfo[]>('get_recent_repos');
      set({ recentRepos: repos });

      // If there are recent repos, find the most recently opened one that is still valid
      if (repos.length > 0) {
        for (const candidate of repos) {
          try {
            const validation = await invoke<RepoValidation>('validate_repo', {
              repoPath: candidate.local_path,
            });

            if (validation.is_valid) {
              console.log(
                `[Stage0] Auto-opening last valid repository: ${candidate.name} (${candidate.local_path})`
              );
              await get().selectRepo(candidate);
              break;
            } else {
              console.warn(
                `[Stage0] Skipping invalid repo '${candidate.name}' (${candidate.local_path}):`,
                validation.error_message
              );
            }
          } catch (valErr) {
            console.warn(
              `[Stage0] Failed to validate candidate repo '${candidate.local_path}':`,
              valErr
            );
          }
        }
      }
    } catch (err: unknown) {
      console.warn('Failed to initialize app repositories:', err);
    } finally {
      set({ isInitializing: false });
    }
  },

  loadRecentRepos: async () => {
    try {
      const repos = await invoke<RepoInfo[]>('get_recent_repos');
      set({ recentRepos: repos });
    } catch (err: unknown) {
      console.warn('Failed to load recent repositories:', err);
    }
  },

  openRepoDialog: async () => {
    set({ isLoading: true, error: null });
    try {
      const repo = await invoke<RepoInfo | null>('open_repo_dialog');
      if (repo) {
        set({ currentRepo: repo });
        await get().fetchBranches(repo.local_path);
        await get().loadRecentRepos();
      }
    } catch (err: unknown) {
      set({ error: String(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  selectRepo: async (repo: RepoInfo) => {
    set({ currentRepo: repo, isLoading: true, error: null });
    try {
      try {
        await invoke<RepoInfo>('open_repo_by_path', { repoPath: repo.local_path });
        await get().loadRecentRepos();
      } catch (touchErr) {
        console.warn('Failed to update repo last_opened_at:', touchErr);
      }
      await get().fetchBranches(repo.local_path);
    } catch (err: unknown) {
      set({ error: String(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  removeRecentRepo: async (id: string) => {
    try {
      await invoke('delete_recent_repo', { id });
      const { currentRepo } = get();
      if (currentRepo?.id === id) {
        set({
          currentRepo: null,
          branches: null,
          baseBranch: '',
          compareBranch: '',
          diffPayload: null,
          conflictReport: null,
          selectedFile: null,
        });
      }
      await get().loadRecentRepos();
    } catch (err) {
      console.error('Failed to remove recent repo:', err);
    }
  },

  fetchBranches: async (repoPath: string) => {
    try {
      const branches = await invoke<BranchList>('get_branches', { repoPath });
      let base = 'main';
      if (!branches.local.includes('main')) {
        if (branches.local.includes('master')) {
          base = 'master';
        } else if (branches.local.length > 0) {
          base = branches.local[0];
        }
      }

      let compare = branches.current || base;
      if (compare === base && branches.local.length > 1) {
        const other = branches.local.find((b) => b !== base);
        if (other) compare = other;
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

  swapBranches: async () => {
    const { baseBranch, compareBranch } = get();
    set({ baseBranch: compareBranch, compareBranch: baseBranch });
    await get().loadDiff();
  },

  loadDiff: async () => {
    const { currentRepo, baseBranch, compareBranch } = get();
    if (!currentRepo || !baseBranch || !compareBranch) return;

    set({ isDiffLoading: true, error: null });
    try {
      const [diffPayload, conflictReport] = await Promise.all([
        invoke<MrDiffPayload>('get_mr_diff', {
          repoPath: currentRepo.local_path,
          base: baseBranch,
          compare: compareBranch,
        }),
        invoke<ConflictReport>('check_merge_conflicts', {
          repoPath: currentRepo.local_path,
          base: baseBranch,
          compare: compareBranch,
        }),
      ]);

      const currentSelected = get().selectedFile;
      let nextSelected: ChangedFile | null = null;

      if (diffPayload.files.length > 0) {
        if (currentSelected) {
          nextSelected =
            diffPayload.files.find((f) => f.path === currentSelected.path) ||
            diffPayload.files[0];
        } else {
          nextSelected = diffPayload.files[0];
        }
      }

      set({
        diffPayload,
        conflictReport,
        selectedFile: nextSelected,
      });
    } catch (err: unknown) {
      set({ error: String(err) });
    } finally {
      set({ isDiffLoading: false });
    }
  },

  refreshDiff: async () => {
    const { currentRepo, baseBranch, compareBranch } = get();
    if (!currentRepo || !baseBranch || !compareBranch) return;

    try {
      const [diffPayload, conflictReport] = await Promise.all([
        invoke<MrDiffPayload>('get_mr_diff', {
          repoPath: currentRepo.local_path,
          base: baseBranch,
          compare: compareBranch,
        }),
        invoke<ConflictReport>('check_merge_conflicts', {
          repoPath: currentRepo.local_path,
          base: baseBranch,
          compare: compareBranch,
        }),
      ]);

      const currentSelected = get().selectedFile;
      let nextSelected: ChangedFile | null = null;

      if (diffPayload.files.length > 0) {
        if (currentSelected) {
          nextSelected =
            diffPayload.files.find((f) => f.path === currentSelected.path) ||
            diffPayload.files[0];
        } else {
          nextSelected = diffPayload.files[0];
        }
      }

      set({
        diffPayload,
        conflictReport,
        selectedFile: nextSelected,
      });
    } catch (err: unknown) {
      console.error('Silent refresh failed:', err);
    }
  },

  selectFile: (file: ChangedFile | null) => {
    set({ selectedFile: file });
  },

  selectNextFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    if (!selectedFile) {
      set({ selectedFile: diffPayload.files[0] });
      return;
    }
    const idx = diffPayload.files.findIndex((f) => f.path === selectedFile.path);
    if (idx !== -1 && idx < diffPayload.files.length - 1) {
      set({ selectedFile: diffPayload.files[idx + 1] });
    }
  },

  selectPrevFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    if (!selectedFile) {
      set({ selectedFile: diffPayload.files[0] });
      return;
    }
    const idx = diffPayload.files.findIndex((f) => f.path === selectedFile.path);
    if (idx > 0) {
      set({ selectedFile: diffPayload.files[idx - 1] });
    }
  },

  setFileListLayout: (layout: 'flat' | 'tree') => {
    set({ fileListLayout: layout });
  },

  setViewMode: (mode: ViewMode) => {
    set({ viewMode: mode });
  },

  fetchRemotes: async (repoPath: string) => {
    try {
      const remotes = await invoke<string[]>('list_git_remotes', { repoPath });
      set({ remotes });
    } catch (err) {
      console.warn('Failed to list git remotes:', err);
    }
  },

  runSync: async (op: GitSyncOperation, options?: GitSyncOptions) => {
    const { currentRepo } = get();
    if (!currentRepo) return;

    const opLabel = op.replace('_', ' ');
    set({ isSyncing: true, syncStatus: `Running git ${opLabel}...`, error: null });
    try {
      const result = await invoke<string>('run_git_sync', {
        repoPath: currentRepo.local_path,
        operation: op,
        options: options || null,
      });
      set({ syncStatus: result });
      await get().fetchBranches(currentRepo.local_path);
      await get().loadDiff();
    } catch (err: unknown) {
      set({ error: String(err), syncStatus: null });
    } finally {
      set({ isSyncing: false });
    }
  },
}));
