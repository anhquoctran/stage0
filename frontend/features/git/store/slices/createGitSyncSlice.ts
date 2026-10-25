import { invoke } from '../../../../common/services/ipc/ipcClient';
import type { StateCreator } from 'zustand';
import { createGitProgressChannel } from '../../services/createGitProgressChannel';
import { getErrorMessage } from '../../services/gitStoreEffects';
import type { GitState } from '../../types/GitState';
import { type GitSyncOperation } from '../../types/GitSyncOperation';
import { type GitSyncOptions } from '../../types/GitSyncOptions';
import { useGitTaskStore } from '../useGitTaskStore';

export const createGitSyncSlice: StateCreator<
  GitState,
  [],
  [],
  Pick<GitState, 'isRebasing' | 'isSyncing' | 'checkRebaseStatus' | 'runSync'>
> = (set, get) => ({
  isRebasing: false,

  isSyncing: false,

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
    if (get().isSyncing) {
      const running = useGitTaskStore
        .getState()
        .tasks.find((task) => task.status === 'running' && task.operation !== 'clone');
      if (running) useGitTaskStore.getState().showTask(running.id);
      return;
    }

    const opLabel = op.replaceAll('_', ' ');
    let taskId: string;
    try {
      taskId = useGitTaskStore
        .getState()
        .startTask(
          op,
          `${opLabel.charAt(0).toUpperCase()}${opLabel.slice(1)}`,
          currentRepo.local_path
        );
    } catch {
      return;
    }
    set({
      isSyncing: true,
      error: null,
      isPullFromOpen: false,
      isMergeFromOpen: false,
      isRebaseFromOpen: false,
    });
    try {
      const result = await invoke<string>('run_git_sync', {
        repoPath: currentRepo.local_path,
        operation: op,
        options: options || null,
        onProgress: createGitProgressChannel(taskId),
      });
      useGitTaskStore.getState().updateTask(taskId, {
        phase: 'Refreshing repository',
        percent: null,
        message: 'Git command finished. Refreshing branch state…',
      });
      if (get().currentRepo?.local_path === currentRepo.local_path) {
        await get().fetchBranches(currentRepo.local_path);
        if (get().currentRepo?.local_path === currentRepo.local_path) {
          await get().loadDiff();
        }
      }
      useGitTaskStore.getState().completeTask(taskId, result);
    } catch (err: unknown) {
      useGitTaskStore.getState().failTask(taskId, getErrorMessage(err));
    } finally {
      if (get().currentRepo?.local_path === currentRepo.local_path) {
        await get().checkRebaseStatus(currentRepo.local_path);
      }
      set({ isSyncing: false });
    }
  },
});
