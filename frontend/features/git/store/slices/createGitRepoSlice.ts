import type { RepositoryInitializationProgress } from '../../types/RepositoryInitializationProgress';
import { getApplicationServices } from '../../../../core/services/runtime/applicationRuntime';

import type { StateCreator } from 'zustand';
import {
  getErrorMessage,
  gitDiffRequests,
  syncRecentRepositoriesMenu,
} from '../../services/gitStoreEffects';
import type { GitState } from '../../types/GitState';
import { type RepoInfo } from '../../types/RepoInfo';
import { createGitCloneActions } from './createGitCloneActions';

export const createGitRepoSlice: StateCreator<
  GitState,
  [],
  [],
  Pick<
    GitState,
    | 'currentRepo'
    | 'recentRepos'
    | 'remotes'
    | 'remoteUrl'
    | 'isInitializing'
    | 'isLoading'
    | 'error'
    | 'clearError'
    | 'closeRepo'
    | 'initApp'
    | 'loadRecentRepos'
    | 'attachRepoToCurrentWindow'
    | 'openRepoDialog'
    | 'pickCloneFolder'
    | 'cloneRepo'
    | 'selectRepo'
    | 'removeRecentRepo'
    | 'clearRecentRepos'
    | 'fetchRemotes'
    | 'fetchRemoteUrl'
  >
> = (set, get) => ({
  currentRepo: null,

  recentRepos: [],

  remotes: [],

  remoteUrl: null,

  isInitializing: true,

  isLoading: false,

  error: null,

  clearError: () => set({ error: null }),

  closeRepo: async () => {
    try {
      await getApplicationServices().gitRepositories.closeRepositoryWindow();
    } catch (err) {
      set({ error: getErrorMessage(err) });
      return;
    }
    gitDiffRequests.version += 1;
    set({
      currentRepo: null,
      isPullFromOpen: false,
      isMergeFromOpen: false,
      isRebaseFromOpen: false,
      isGitGraphOpen: false,
      isRepoOverviewOpen: false,
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

  initApp: async (restoreRecent = true, onProgress) => {
    set({ isInitializing: true });
    let completed = 0;
    const report = (progress: RepositoryInitializationProgress) => {
      // Presentation observers must not interrupt repository initialization.
      try { onProgress?.(progress); } catch { /* Keep the workflow authoritative. */ }
    };
    function track<T>(request: Promise<T>): Promise<T> {
      return request.finally(() => report({ phase: 'catalog', completed: ++completed, total: 3 }));
    }
    report({ phase: 'catalog', completed: 0, total: 3 });
    try {
      // Await every catalog operation, including recoverable failures, before
      // allowing startup to advance to workspace restoration.
      const [recent] = await Promise.allSettled([
        track(getApplicationServices().gitRepositories.getRecentRepos()),
        track(get().fetchAvailableSandboxes()),
        track(get().fetchActiveSandbox()),
      ]);
      if (recent.status === 'rejected') throw recent.reason;
      const repos = recent.value;
      set({ recentRepos: repos });
      await syncRecentRepositoriesMenu(repos);
      report({ phase: 'workspace', completed: 0, total: 1 });

      let openedAny = false;
      // Only the original welcome window restores the last repository. New windows
      // start empty so opening another window cannot silently duplicate a repo.
      if (restoreRecent && repos.length > 0) {
        for (const candidate of repos) {
          try {
            const validation = await getApplicationServices().gitRepositories.validateRepo({
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
          await getApplicationServices().application.windowResetSize();
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
      const repos = await getApplicationServices().gitRepositories.getRecentRepos();
      set({ recentRepos: repos });
      await syncRecentRepositoriesMenu(repos);
    } catch (err: unknown) {
      console.warn('Failed to load recent repositories:', err);
    }
  },

  attachRepoToCurrentWindow: async (repo: RepoInfo) => {
    try {
      await getApplicationServices().application.windowMaximize();
    } catch {}
    if (get().currentRepo?.local_path === repo.local_path) return;
    gitDiffRequests.version += 1;
    set({
      currentRepo: repo,
      isPullFromOpen: false,
      isMergeFromOpen: false,
      isRebaseFromOpen: false,
      isGitGraphOpen: false,
      isRepoOverviewOpen: false,
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
      const outcome = await getApplicationServices().gitRepositories.openRepoDialog({
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

  ...createGitCloneActions(set, get),

  selectRepo: async (repo: RepoInfo) => {
    set({ isLoading: true, error: null });
    try {
      const outcome = await getApplicationServices().gitRepositories.openRepoByPath({
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
      await getApplicationServices().gitRepositories.deleteRecentRepo({ id });
      const { currentRepo } = get();
      if (currentRepo?.id === id) {
        gitDiffRequests.version += 1;
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
      await getApplicationServices().gitRepositories.clearRecentRepos();
      set({ recentRepos: [] });
      await syncRecentRepositoriesMenu([]);
      get().showToast('Cleared all recent repositories');
    } catch (err) {
      console.error('Failed to clear recent repositories:', err);
    }
  },

  fetchRemotes: async (repoPath: string) => {
    try {
      const remotes = await getApplicationServices().gitRepositories.listGitRemotes({ repoPath });
      if (get().currentRepo?.local_path !== repoPath) return;
      set({ remotes });
      await get().fetchRemoteUrl(repoPath);
    } catch (err) {
      console.warn('Failed to list git remotes:', err);
    }
  },

  fetchRemoteUrl: async (repoPath: string) => {
    try {
      const url = await getApplicationServices().gitRepositories.getGitRemoteUrl({ repoPath, remote: null });
      set({ remoteUrl: url });
      return url;
    } catch (err) {
      console.warn('Failed to get remote url:', err);
      set({ remoteUrl: null });
      return null;
    }
  },
});
