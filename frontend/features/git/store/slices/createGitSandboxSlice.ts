import { getApplicationServices } from '../../../../core/services/runtime/applicationRuntime';

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
      const instance = await getApplicationServices().sandboxes.createSandboxInstance({
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
      await getApplicationServices().sandboxes.destroySandboxInstance({ instanceId: id });
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
      const result = await getApplicationServices().sandboxes.executeSandboxCommand({
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
});
