import { getApplicationServices } from '../../../../core/services/runtime/applicationRuntime';
import i18n from '../../../i18n/i18n';

import type { StateCreator } from 'zustand';
import type { GitState } from '../../types/GitState';
import { type SandboxType } from '../../types/SandboxType';

export const createGitSandboxSlice: StateCreator<
  GitState,
  [],
  [],
  Pick<
    GitState,
    | 'activeSandboxType'
    | 'availableSandboxes'
    | 'activeSandboxInstances'
    | 'isSandboxLoading'
    | 'fetchAvailableSandboxes'
    | 'fetchActiveSandbox'
    | 'setActiveSandbox'
    | 'createSandboxInstance'
    | 'destroySandboxInstance'
    | 'executeSandboxCommand'
  >
> = (set, get) => ({
  activeSandboxType: 'in_memory',

  availableSandboxes: [],

  activeSandboxInstances: [],

  isSandboxLoading: false,

  fetchAvailableSandboxes: async () => {
    try {
      const sandboxes = await getApplicationServices().sandboxes.getAvailableSandboxes();
      set({ availableSandboxes: sandboxes });
    } catch (err) {
      console.warn('Failed to fetch available sandboxes:', err);
    }
  },

  fetchActiveSandbox: async () => {
    try {
      const active = await getApplicationServices().sandboxes.getActiveSandbox();
      set({ activeSandboxType: active });
    } catch (err) {
      console.warn('Failed to fetch active sandbox:', err);
    }
  },

  setActiveSandbox: async (type: SandboxType) => {
    set({ isSandboxLoading: true });
    try {
      const active = await getApplicationServices().sandboxes.setActiveSandbox({ adapterType: type });
      set({ activeSandboxType: active });
      const label =
        active === 'in_memory'
          ? i18n.t('ai.sandbox.adapters.inMemoryTitle')
          : active === 'local_worktree'
            ? i18n.t('ai.sandbox.adapters.worktreeTitle')
            : i18n.t('ai.sandbox.adapters.dockerTitle');
      get().showToast(i18n.t('git.toasts.sandboxSwitched', { label }));
      await get().refreshDiff();
    } catch (err) {
      get().showToast(i18n.t('git.toasts.sandboxSwitchFailed', { error: String(err) }));
    } finally {
      set({ isSandboxLoading: false });
    }
  },

  createSandboxInstance: async () => {
    const { currentRepo, baseBranch, compareBranch } = get();
    if (!currentRepo || !baseBranch || !compareBranch) return null;
    try {
      const instance = await getApplicationServices().sandboxes.createSandboxInstance({
        repoPath: currentRepo.local_path,
        base: baseBranch,
        compare: compareBranch,
      });
      set((state) => ({
        activeSandboxInstances: [...state.activeSandboxInstances, instance],
      }));
      get().showToast(i18n.t('git.toasts.sandboxCreated', { id: instance.id }));
      return instance;
    } catch (err) {
      get().showToast(i18n.t('git.toasts.sandboxCreateFailed', { error: String(err) }));
      return null;
    }
  },

  destroySandboxInstance: async (id: string) => {
    try {
      await getApplicationServices().sandboxes.destroySandboxInstance({ instanceId: id });
      set((state) => ({
        activeSandboxInstances: state.activeSandboxInstances.filter((i) => i.id !== id),
      }));
      get().showToast(i18n.t('git.toasts.sandboxDestroyed', { id }));
    } catch (err) {
      get().showToast(i18n.t('git.toasts.sandboxDestroyFailed', { error: String(err) }));
    }
  },

  executeSandboxCommand: async (id: string, command: string, args: string[]) => {
    try {
      const result = await getApplicationServices().sandboxes.executeSandboxCommand({
        instanceId: id,
        command,
        args,
      });
      return result;
    } catch (err) {
      get().showToast(i18n.t('git.toasts.sandboxCommandFailed', { error: String(err) }));
      return null;
    }
  },
});
