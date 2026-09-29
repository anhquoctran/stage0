import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  BranchList,
  ChangedFile,
  ConflictReport,
  ConflictFilePreview,
  MrDiffPayload,
  RepoInfo,
  RepoValidation,
  ViewMode,
  GitSyncOperation,
  GitSyncOptions,
  FileBlamePayload,
  SandboxType,
  SandboxAdapterInfo,
  SandboxInstanceInfo,
  SandboxExecutionResult,
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
  selectNextConflictFile: () => void;
  selectPrevConflictFile: () => void;
  setViewMode: (mode: ViewMode) => void;
  setFileListLayout: (layout: 'flat' | 'tree') => void;
  remotes: string[];
  remoteUrl: string | null;
  isRebasing: boolean;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  isPullFromOpen: boolean;
  isRebaseFromOpen: boolean;
  isRemoteUrlFromOpen: boolean;
  targetFileForUrl: ChangedFile | null;
  setIsPullFromOpen: (open: boolean) => void;
  setIsRebaseFromOpen: (open: boolean) => void;
  setIsRemoteUrlFromOpen: (open: boolean) => void;
  setTargetFileForUrl: (file: ChangedFile | null) => void;
  fetchRemotes: (repoPath: string) => Promise<void>;
  fetchRemoteUrl: (repoPath: string) => Promise<string | null>;
  checkRebaseStatus: (repoPath?: string) => Promise<boolean>;
  runSync: (op: GitSyncOperation, options?: GitSyncOptions) => Promise<void>;
  fileViewTab: 'diff' | 'blame' | 'conflicts';
  blamePayload: FileBlamePayload | null;
  isBlameLoading: boolean;
  blameError: string | null;
  blameRevision: string;
  blameIgnoreWhitespace: boolean;
  activeConflictPreview: ConflictFilePreview | null;
  isConflictLoading: boolean;
  conflictPreviewError: string | null;
  setFileViewTab: (tab: 'diff' | 'blame' | 'conflicts') => void;
  setBlameRevision: (rev: string) => void;
  setBlameIgnoreWhitespace: (ignore: boolean) => void;
  fetchFileBlame: (filePath?: string, revision?: string, ignoreWhitespace?: boolean) => Promise<void>;
  fetchConflictPreview: (filePath?: string) => Promise<void>;
  toggleFileBlame: () => void;
  activeSandboxType: SandboxType;
  availableSandboxes: SandboxAdapterInfo[];
  activeSandboxInstances: SandboxInstanceInfo[];
  isSandboxLoading: boolean;
  fetchAvailableSandboxes: () => Promise<void>;
  fetchActiveSandbox: () => Promise<void>;
  setActiveSandbox: (type: SandboxType) => Promise<void>;
  createSandboxInstance: () => Promise<SandboxInstanceInfo | null>;
  destroySandboxInstance: (id: string) => Promise<void>;
  executeSandboxCommand: (id: string, command: string, args: string[]) => Promise<SandboxExecutionResult | null>;
  clearError: () => void;
  closeRepo: () => void;
}

export const useGitStore = create<GitState>((set, get) => ({
  currentRepo: null,
  recentRepos: [],
  branches: null,
  remotes: [],
  remoteUrl: null,
  toastMessage: null,
  showToast: (msg: string) => {
    set({ toastMessage: msg });
    setTimeout(() => {
      if (get().toastMessage === msg) {
        set({ toastMessage: null });
      }
    }, 2500);
  },
  isPullFromOpen: false,
  isRebaseFromOpen: false,
  isRemoteUrlFromOpen: false,
  targetFileForUrl: null,
  isRebasing: false,
  fileViewTab: 'diff',
  blamePayload: null,
  isBlameLoading: false,
  blameError: null,
  blameRevision: '',
  blameIgnoreWhitespace: false,
  activeConflictPreview: null,
  isConflictLoading: false,
  conflictPreviewError: null,
  activeSandboxType: 'in_memory',
  availableSandboxes: [],
  activeSandboxInstances: [],
  isSandboxLoading: false,
  setIsPullFromOpen: (open) => set({ isPullFromOpen: open }),
  setIsRebaseFromOpen: (open) => set({ isRebaseFromOpen: open }),
  setIsRemoteUrlFromOpen: (open) => set({ isRemoteUrlFromOpen: open }),
  setTargetFileForUrl: (file) => set({ targetFileForUrl: file }),
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
      remotes: [],
      remoteUrl: null,
      isRebasing: false,
      blamePayload: null,
      blameError: null,
      fileViewTab: 'diff',
    }),

  initApp: async () => {
    set({ isInitializing: true });
    try {
      const [repos] = await Promise.all([
        invoke<RepoInfo[]>('get_recent_repos'),
        get().fetchAvailableSandboxes(),
        get().fetchActiveSandbox(),
      ]);
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
        await get().checkRebaseStatus(repo.local_path);
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
      await get().checkRebaseStatus(repo.local_path);
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
          isRebasing: false,
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
      get().checkRebaseStatus(currentRepo.local_path);
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
      get().checkRebaseStatus(currentRepo.local_path);
    } catch (err: unknown) {
      console.error('Silent refresh failed:', err);
    }
  },

  selectFile: (file: ChangedFile | null) => {
    set({ selectedFile: file, activeConflictPreview: null });
    if (file) {
      if (file.is_conflicted) {
        get().fetchConflictPreview(file.path);
      }
      if (get().fileViewTab === 'blame') {
        get().fetchFileBlame(file.path);
      }
    }
  },

  selectNextFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    if (!selectedFile) {
      set({ selectedFile: diffPayload.files[0] });
      if (get().fileViewTab === 'blame') {
        get().fetchFileBlame(diffPayload.files[0].path);
      }
      return;
    }
    const idx = diffPayload.files.findIndex((f) => f.path === selectedFile.path);
    if (idx !== -1 && idx < diffPayload.files.length - 1) {
      const next = diffPayload.files[idx + 1];
      set({ selectedFile: next });
      if (get().fileViewTab === 'blame') {
        get().fetchFileBlame(next.path);
      }
    }
  },

  selectPrevFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    if (!selectedFile) {
      set({ selectedFile: diffPayload.files[0] });
      if (get().fileViewTab === 'blame') {
        get().fetchFileBlame(diffPayload.files[0].path);
      }
      return;
    }
    const idx = diffPayload.files.findIndex((f) => f.path === selectedFile.path);
    if (idx > 0) {
      const prev = diffPayload.files[idx - 1];
      set({ selectedFile: prev });
      if (get().fileViewTab === 'blame') {
        get().fetchFileBlame(prev.path);
      }
    }
  },

  selectNextConflictFile: () => {
    const { diffPayload, selectedFile } = get();
    if (!diffPayload || diffPayload.files.length === 0) return;
    const conflicted = diffPayload.files.filter((f) => f.is_conflicted);
    if (conflicted.length === 0) return;

    if (!selectedFile || !selectedFile.is_conflicted) {
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
    const conflicted = diffPayload.files.filter((f) => f.is_conflicted);
    if (conflicted.length === 0) return;

    if (!selectedFile || !selectedFile.is_conflicted) {
      get().selectFile(conflicted[conflicted.length - 1]);
      return;
    }

    const currentIdx = conflicted.findIndex((f) => f.path === selectedFile.path);
    const prevIdx = (currentIdx - 1 + conflicted.length) % conflicted.length;
    get().selectFile(conflicted[prevIdx]);
  },

  setFileViewTab: (tab: 'diff' | 'blame' | 'conflicts') => {
    set({ fileViewTab: tab });
    if (tab === 'blame') {
      get().fetchFileBlame();
    } else if (tab === 'conflicts' && get().selectedFile?.is_conflicted) {
      get().fetchConflictPreview();
    }
  },

  fetchConflictPreview: async (filePath?: string) => {
    const { currentRepo, baseBranch, compareBranch, selectedFile } = get();
    const targetFile = filePath || selectedFile?.path;
    if (!currentRepo || !baseBranch || !compareBranch || !targetFile) return;

    set({ isConflictLoading: true, conflictPreviewError: null });
    try {
      const preview = await invoke<ConflictFilePreview>('get_conflicted_file_preview', {
        repoPath: currentRepo.local_path,
        base: baseBranch,
        compare: compareBranch,
        filePath: targetFile,
      });
      set({ activeConflictPreview: preview });
    } catch (err: unknown) {
      console.warn('Failed to load conflict preview:', err);
      set({ conflictPreviewError: String(err) });
    } finally {
      set({ isConflictLoading: false });
    }
  },

  setBlameRevision: (rev: string) => {
    set({ blameRevision: rev });
    get().fetchFileBlame(undefined, rev);
  },

  setBlameIgnoreWhitespace: (ignore: boolean) => {
    set({ blameIgnoreWhitespace: ignore });
    get().fetchFileBlame(undefined, undefined, ignore);
  },

  fetchFileBlame: async (filePath?: string, revision?: string, ignoreWhitespace?: boolean) => {
    const { currentRepo, selectedFile, compareBranch, blameRevision, blameIgnoreWhitespace } = get();
    const targetFile = filePath || selectedFile?.path;
    if (!currentRepo || !targetFile) return;

    const rev = revision !== undefined ? revision : (blameRevision || compareBranch || 'HEAD');
    const ignoreWs = ignoreWhitespace !== undefined ? ignoreWhitespace : blameIgnoreWhitespace;

    set({ isBlameLoading: true, blameError: null, blameRevision: rev, blameIgnoreWhitespace: ignoreWs });
    try {
      const payload = await invoke<FileBlamePayload>('get_file_blame', {
        repoPath: currentRepo.local_path,
        filePath: targetFile,
        revision: rev || null,
        ignoreWhitespace: ignoreWs,
      });
      set({ blamePayload: payload, isBlameLoading: false });
    } catch (err: unknown) {
      console.warn('Failed to fetch file blame:', err);
      set({ blameError: String(err), isBlameLoading: false, blamePayload: null });
    }
  },

  toggleFileBlame: () => {
    const currentTab = get().fileViewTab;
    const nextTab = currentTab === 'diff' ? 'blame' : 'diff';
    get().setFileViewTab(nextTab);
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
      await get().fetchRemoteUrl(repoPath);
    } catch (err) {
      console.warn('Failed to list git remotes:', err);
    }
  },

  fetchRemoteUrl: async (repoPath: string) => {
    try {
      const url = await invoke<string>('get_git_remote_url', { repoPath, remote: null });
      set({ remoteUrl: url });
      return url;
    } catch (err) {
      console.warn('Failed to get remote url:', err);
      set({ remoteUrl: null });
      return null;
    }
  },

  checkRebaseStatus: async (repoPath?: string) => {
    const path = repoPath || get().currentRepo?.local_path;
    if (!path) {
      set({ isRebasing: false });
      return false;
    }
    try {
      const active = await invoke<boolean>('check_rebase_status', { repoPath: path });
      set({ isRebasing: active });
      return active;
    } catch (err) {
      console.warn('Failed to check rebase status:', err);
      set({ isRebasing: false });
      return false;
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
      await get().checkRebaseStatus(currentRepo.local_path);
    } catch (err: unknown) {
      set({ error: String(err), syncStatus: null });
    } finally {
      await get().checkRebaseStatus(currentRepo.local_path);
      set({ isSyncing: false });
    }
  },

  fetchAvailableSandboxes: async () => {
    try {
      const sandboxes = await invoke<SandboxAdapterInfo[]>('get_available_sandboxes');
      set({ availableSandboxes: sandboxes });
    } catch (err) {
      console.warn('Failed to fetch available sandboxes:', err);
    }
  },

  fetchActiveSandbox: async () => {
    try {
      const active = await invoke<SandboxType>('get_active_sandbox');
      set({ activeSandboxType: active });
    } catch (err) {
      console.warn('Failed to fetch active sandbox:', err);
    }
  },

  setActiveSandbox: async (type: SandboxType) => {
    set({ isSandboxLoading: true });
    try {
      const active = await invoke<SandboxType>('set_active_sandbox', { adapterType: type });
      set({ activeSandboxType: active });
      const label =
        active === 'in_memory'
          ? 'In-Memory Sandbox'
          : active === 'local_worktree'
          ? 'Local Worktree Sandbox'
          : 'Docker Container Sandbox';
      get().showToast(`Switched active sandbox to: ${label}`);
      await get().refreshDiff();
    } catch (err) {
      get().showToast(`Failed to switch sandbox: ${err}`);
    } finally {
      set({ isSandboxLoading: false });
    }
  },

  createSandboxInstance: async () => {
    const { currentRepo, baseBranch, compareBranch } = get();
    if (!currentRepo || !baseBranch || !compareBranch) return null;
    try {
      const instance = await invoke<SandboxInstanceInfo>('create_sandbox_instance', {
        repoPath: currentRepo.local_path,
        base: baseBranch,
        compare: compareBranch,
      });
      set((state) => ({
        activeSandboxInstances: [...state.activeSandboxInstances, instance],
      }));
      get().showToast(`Created sandbox instance: ${instance.id}`);
      return instance;
    } catch (err) {
      get().showToast(`Failed to create sandbox instance: ${err}`);
      return null;
    }
  },

  destroySandboxInstance: async (id: string) => {
    try {
      await invoke('destroy_sandbox_instance', { instanceId: id });
      set((state) => ({
        activeSandboxInstances: state.activeSandboxInstances.filter((i) => i.id !== id),
      }));
      get().showToast(`Destroyed sandbox instance: ${id}`);
    } catch (err) {
      get().showToast(`Failed to destroy sandbox instance: ${err}`);
    }
  },

  executeSandboxCommand: async (id: string, command: string, args: string[]) => {
    try {
      const result = await invoke<SandboxExecutionResult>('execute_sandbox_command', {
        instanceId: id,
        command,
        args,
      });
      return result;
    } catch (err) {
      get().showToast(`Sandbox command failed: ${err}`);
      return null;
    }
  },
}));
