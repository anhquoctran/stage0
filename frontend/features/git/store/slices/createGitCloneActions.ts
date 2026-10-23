import { invoke } from '@tauri-apps/api/core';
import type { StoreApi } from 'zustand';
import { createGitProgressChannel } from '../../services/createGitProgressChannel';
import { getErrorMessage } from '../../services/gitStoreEffects';
import type { CloneOptions } from '../../types/CloneOptions';
import type { GitState } from '../../types/GitState';
import { type OpenRepoOutcome } from '../../types/OpenRepoOutcome';
import { type RepoInfo } from '../../types/RepoInfo';
import { useGitTaskStore } from '../useGitTaskStore';
export const createGitCloneActions = (
  set: StoreApi<GitState>['setState'],
  get: StoreApi<GitState>['getState']
): Pick<GitState, 'pickCloneFolder' | 'cloneRepo'> => ({
  pickCloneFolder: async () => {
    try {
      const folder = await invoke<string | null>('pick_folder');
      return folder;
    } catch (err) {
      console.warn('Failed to pick folder:', err);
      return null;
    }
  },

  cloneRepo: async (
    url: string,
    targetPath: string,
    credentialId?: string,
    options?: CloneOptions
  ) => {
    const taskId = useGitTaskStore.getState().startTask('clone', 'Clone repository', targetPath);
    set({ error: null, isCloneModalOpen: false });
    try {
      const repo = await invoke<RepoInfo>('clone_repository', {
        url,
        targetPath,
        credentialId: credentialId ?? null,
        options: options ?? null,
        onProgress: createGitProgressChannel(taskId),
      });
      if (repo) {
        useGitTaskStore.getState().updateTask(taskId, {
          phase: 'Opening repository',
          percent: null,
          message: 'Repository cloned. Opening repository…',
        });
        try {
          // Route through the window manager even after backgrounding or a repo
          // switch. It preserves the current repo by opening/focusing another window.
          const outcome = await invoke<OpenRepoOutcome>('open_repo_by_path', {
            repoPath: repo.local_path,
          });
          if (outcome.action === 'opened_here') {
            await get().attachRepoToCurrentWindow(outcome.repo);
          } else {
            await get().loadRecentRepos();
          }
        } catch (error) {
          throw new Error(
            `Repository was cloned to '${repo.local_path}', but could not be opened automatically: ${getErrorMessage(error)}`
          );
        }
        useGitTaskStore.getState().completeTask(taskId, `Cloned repository ${repo.name}`, repo);
        useGitTaskStore.getState().dismissTask(taskId);
        get().showToast(`Cloned repository ${repo.name}`);
        return repo;
      }
      useGitTaskStore.getState().failTask(taskId, 'Clone did not return a repository.');
      return null;
    } catch (err: unknown) {
      useGitTaskStore.getState().failTask(taskId, getErrorMessage(err));
      throw err;
    }
  },
});
