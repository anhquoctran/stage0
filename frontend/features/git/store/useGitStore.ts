import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { type BranchList } from '../types/BranchList';
import { type ChangedFile } from '../types/ChangedFile';
import { type ConflictReport } from '../types/ConflictReport';
import { type ConflictFilePreview } from '../types/ConflictFilePreview';
import { type MrDiffPayload } from '../types/MrDiffPayload';
import { type RepoInfo } from '../types/RepoInfo';
import { type RepoValidation } from '../types/RepoValidation';
import { type ViewMode } from '../types/ViewMode';
import { type GitSyncOperation } from '../types/GitSyncOperation';
import { type GitSyncOptions } from '../types/GitSyncOptions';
import { type FileBlamePayload } from '../types/FileBlamePayload';
import { type SandboxType } from '../types/SandboxType';
import { type SandboxAdapterInfo } from '../types/SandboxAdapterInfo';
import { type SandboxInstanceInfo } from '../types/SandboxInstanceInfo';
import { type SandboxExecutionResult } from '../types/SandboxExecutionResult';
import { type OpenRepoOutcome } from '../types/OpenRepoOutcome';
import type { GitState } from '../types/GitState';

const syncRecentRepositoriesMenu = async (repositories: RepoInfo[]): Promise<void> => {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return;

  try {
    await invoke('update_recent_repositories_menu', { repositories });
  } catch (error) {
    console.warn('Failed to update the native recent repositories menu:', error);
  }
};

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error) || String(error);
  } catch {
    return String(error);
  }
};

let diffRequestVersion = 0;

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
  isMergeFromOpen: false,
  isRebaseFromOpen: false,
  isGitGraphOpen: false,
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
  setIsMergeFromOpen: (open) => set({ isMergeFromOpen: open }),
  setIsRebaseFromOpen: (open) => set({ isRebaseFromOpen: open }),
  setIsGitGraphOpen: (open) => set({ isGitGraphOpen: open }),
  setIsRemoteUrlFromOpen: (open) => set({ isRemoteUrlFromOpen: open }),
  isCloneModalOpen: false,
  setIsCloneModalOpen: (open) => set({ isCloneModalOpen: open }),
  setTargetFileForUrl: (file) => set({ targetFileForUrl: file }),
  baseBranch: '',
  compareBranch: '',
  diffPayload: null,
  conflictReport: null,
  diffError: null,
  conflictCheckError: null,
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

  closeRepo: async () => {
    try {
      await invoke('close_repository_window');
    } catch (err) {
      set({ error: getErrorMessage(err) });
      return;
    }
    diffRequestVersion += 1;
    set({
      currentRepo: null,
      isPullFromOpen: false,
      isMergeFromOpen: false,
      isRebaseFromOpen: false,
      isGitGraphOpen: false,
      branches: null,
      baseBranch: '',
      compareBranch: '',
      diffPayload: null,
      conflictReport: null,
      diffError: null,
      conflictCheckError: null,
      selectedFile: null,
      isDiffLoading: false,
      remotes: [],
      remoteUrl: null,
      isRebasing: false,
      blamePayload: null,
      blameError: null,
      fileViewTab: 'diff',
    });
  },

  initApp: async (restoreRecent = true) => {
    set({ isInitializing: true });
    try {
      const [repos] = await Promise.all([
        invoke<RepoInfo[]>('get_recent_repos'),
        get().fetchAvailableSandboxes(),
        get().fetchActiveSandbox(),
      ]);
      set({ recentRepos: repos });
      await syncRecentRepositoriesMenu(repos);

      let openedAny = false;
      // Only the original welcome window restores the last repository. New windows
      // start empty so opening another window cannot silently duplicate a repo.
      if (restoreRecent && repos.length > 0) {
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
              openedAny = true;
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

      // Keep the welcome window at the platform's default size when no repo opens.
      if (!openedAny && !get().currentRepo) {
        try {
          await invoke('window_reset_size');
        } catch {}
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
      await syncRecentRepositoriesMenu(repos);
    } catch (err: unknown) {
      console.warn('Failed to load recent repositories:', err);
    }
  },

  attachRepoToCurrentWindow: async (repo: RepoInfo) => {
    try {
      await invoke('window_maximize');
    } catch {}
    if (get().currentRepo?.local_path === repo.local_path) return;
    diffRequestVersion += 1;
    set({
      currentRepo: repo,
      isPullFromOpen: false,
      isMergeFromOpen: false,
      isRebaseFromOpen: false,
      isGitGraphOpen: false,
      isLoading: true,
      isDiffLoading: false,
      diffPayload: null,
      conflictReport: null,
      diffError: null,
      conflictCheckError: null,
      selectedFile: null,
      branches: null,
      baseBranch: '',
      compareBranch: '',
      remotes: [],
      remoteUrl: null,
      error: null,
    });
    try {
      await get().loadRecentRepos();
      await get().fetchBranches(repo.local_path);
      await get().checkRebaseStatus(repo.local_path);
    } finally {
      if (get().currentRepo?.local_path === repo.local_path) set({ isLoading: false });
    }
  },

  openRepoDialog: async (forceNewWindow = false) => {
    set({ isLoading: true, error: null });
    try {
      const outcome = await invoke<OpenRepoOutcome | null>('open_repo_dialog', {
        forceNewWindow,
      });
      if (outcome?.action === 'opened_here') {
        await get().attachRepoToCurrentWindow(outcome.repo);
      } else if (outcome) {
        await get().loadRecentRepos();
        get().showToast(`Opened ${outcome.repo.name} in another window`);
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  pickCloneFolder: async () => {
    try {
      const folder = await invoke<string | null>('pick_folder');
      return folder;
    } catch (err) {
      console.warn('Failed to pick folder:', err);
      return null;
    }
  },

  cloneRepo: async (url: string, targetPath: string, credentialId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const repo = await invoke<RepoInfo>('clone_repository', {
        url,
        targetPath,
        credentialId: credentialId ?? null,
      });
      if (repo) {
        const outcome = await invoke<OpenRepoOutcome>('open_repo_by_path', {
          repoPath: repo.local_path,
        });
        if (outcome.action === 'opened_here') {
          await get().attachRepoToCurrentWindow(outcome.repo);
        } else {
          await get().loadRecentRepos();
        }
        get().showToast(`Cloned repository ${repo.name}`);
        return repo;
      }
      return null;
    } catch (err: unknown) {
      set({ error: String(err) });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  selectRepo: async (repo: RepoInfo) => {
    set({ isLoading: true, error: null });
    try {
      const outcome = await invoke<OpenRepoOutcome>('open_repo_by_path', {
        repoPath: repo.local_path,
      });
      if (outcome.action === 'opened_here') {
        await get().attachRepoToCurrentWindow(outcome.repo);
      } else {
        await get().loadRecentRepos();
        get().showToast(`Opened ${repo.name} in another window`);
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  removeRecentRepo: async (id: string) => {
    try {
      await invoke('delete_recent_repo', { id });
      const { currentRepo } = get();
      if (currentRepo?.id === id) {
        diffRequestVersion += 1;
        set({
          currentRepo: null,
          branches: null,
          baseBranch: '',
          compareBranch: '',
          diffPayload: null,
          conflictReport: null,
          diffError: null,
          conflictCheckError: null,
          isDiffLoading: false,
          selectedFile: null,
          isRebasing: false,
        });
      }
      await get().loadRecentRepos();
    } catch (err) {
      console.error('Failed to remove recent repo:', err);
    }
  },

  clearRecentRepos: async () => {
    try {
      await invoke('clear_recent_repos');
      set({ recentRepos: [] });
      await syncRecentRepositoriesMenu([]);
      get().showToast('Cleared all recent repositories');
    } catch (err) {
      console.error('Failed to clear recent repositories:', err);
    }
  },

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
        const remoteDefault = branches.remote.find((b) => b.endsWith('/main') || b.endsWith('/master'));
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
    const requestVersion = ++diffRequestVersion;
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
      return requestVersion === diffRequestVersion
        && current.currentRepo?.local_path === repoPath
        && current.baseBranch === baseBranch
        && current.compareBranch === compareBranch;
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
          diffPayload.files.find((f) => f.path === selectedPath) ||
          diffPayload.files[0];
      }

      set({
        diffPayload,
        conflictReport,
        diffError: null,
        conflictCheckError,
        selectedFile: nextSelected,
        ...(nextSelected?.is_binary && get().fileViewTab !== 'diff' ? { fileViewTab: 'diff' as const } : {}),
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
        ...(first.is_binary && get().fileViewTab !== 'diff' ? { fileViewTab: 'diff' as const } : {}),
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
        ...(first.is_binary && get().fileViewTab !== 'diff' ? { fileViewTab: 'diff' as const } : {}),
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

  setFileViewTab: (tab: 'diff' | 'blame' | 'conflicts') => {
    const { selectedFile } = get();
    if (selectedFile?.is_binary && tab !== 'diff') {
      set({ fileViewTab: 'diff' });
      return;
    }
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
    if (selectedFile?.path === targetFile && selectedFile.is_binary) {
      set({ isBlameLoading: false, blameError: null, blamePayload: null });
      return;
    }

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
      if (get().currentRepo?.local_path !== repoPath) return;
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
      if (get().currentRepo?.local_path !== path) return false;
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
