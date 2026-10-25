import { invoke } from '../../../common/services/ipc/ipcClient';
import { type RepoLabel } from '../types/RepoLabel';
import { type RepoSettings } from '../types/RepoSettings';
import { type GitRemoteDetail } from '../types/GitRemoteDetail';
import { type GitTagInfo } from '../types/GitTagInfo';
import { PRESET_REPO_LABELS } from '../types/virtualMr';
import type { VirtualMrState } from '../types/VirtualMrState';

export const createRepoSettingsSlice = (
  set: (partial: Partial<VirtualMrState> | ((state: VirtualMrState) => Partial<VirtualMrState>)) => void,
  get: () => VirtualMrState
) => ({
  createRepoLabel: async (name: string, color: string, description?: string) => {
    const { currentRepoId, repoLabels } = get();
    if (!currentRepoId) return;

    const id = `label-${Date.now()}`;
    const newLabel: RepoLabel = { id, repoId: currentRepoId, name, color, description };
    try {
      await invoke('create_repo_label', {
        label: { id, repo_id: currentRepoId, name, color, description: description || null },
      });
      set({ repoLabels: [...repoLabels, newLabel] });
      return newLabel;
    } catch (e) {
      console.error('Failed to create repo label:', e);
      throw e;
    }
  },

  updateRepoLabel: async (label: RepoLabel) => {
    const { repoLabels, sessions } = get();
    try {
      await invoke('update_repo_label', {
        label: {
          id: label.id,
          repo_id: label.repoId,
          name: label.name,
          color: label.color,
          description: label.description || null,
        },
      });
      set({
        repoLabels: repoLabels.map((l) => (l.id === label.id ? label : l)),
        sessions: sessions.map((s) => ({
          ...s,
          labels: s.labels.map((l) => (l.id === label.id ? label : l)),
        })),
      });
    } catch (e) {
      console.error('Failed to update repo label:', e);
    }
  },

  deleteRepoLabel: async (labelId: string) => {
    const { repoLabels, sessions } = get();
    try {
      await invoke('delete_repo_label', { id: labelId });
      set({
        repoLabels: repoLabels.filter((l) => l.id !== labelId),
        sessions: sessions.map((s) => ({
          ...s,
          labels: s.labels.filter((l) => l.id !== labelId),
        })),
      });
    } catch (e) {
      console.error('Failed to delete repo label:', e);
    }
  },

  loadPresetLabels: async () => {
    const { currentRepoId } = get();
    if (!currentRepoId) return;

    for (const p of PRESET_REPO_LABELS) {
      try {
        await get().createRepoLabel(p.name, p.color, p.description);
      } catch {}
    }
  },

  // Repo Settings Actions
  saveRepoSettings: async (updates: Partial<RepoSettings>) => {
    const { repoSettings, currentRepoId } = get();
    if (!currentRepoId || !repoSettings) return;

    const newSettings: RepoSettings = { ...repoSettings, ...updates };
    set({ repoSettings: newSettings });

    try {
      await invoke('save_repo_settings', {
        settings: {
          repo_id: currentRepoId,
          default_base_branch: newSettings.defaultBaseBranch,
          inherit_global_agents: newSettings.inheritGlobalAgents,
          custom_agent_rules: newSettings.customAgentRules || null,
        },
      });
    } catch (e) {
      console.error('Failed to save repo settings:', e);
    }
  },

  fetchRemotesDetailed: async () => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    try {
      const res = await invoke<GitRemoteDetail[]>('list_git_remotes_detailed', { repoPath: currentRepoPath });
      set({ remotesDetailed: res || [] });
    } catch (err) {
      console.warn('Failed to fetch remotes detailed:', err);
    }
  },

  addRemote: async (name: string, url: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('add_git_remote', { repoPath: currentRepoPath, name, url });
    await get().fetchRemotesDetailed();
  },

  removeRemote: async (name: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('remove_git_remote', { repoPath: currentRepoPath, name });
    await get().fetchRemotesDetailed();
  },

  setRemoteUrl: async (name: string, url: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('set_git_remote_url', { repoPath: currentRepoPath, name, url });
    await get().fetchRemotesDetailed();
  },

  testRemote: async (remoteOrUrl: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return 'No repo open';
    return await invoke<string>('test_git_remote', { repoPath: currentRepoPath, remoteOrUrl });
  },

  // Tags & Branches
  fetchTags: async () => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    try {
      const res = await invoke<GitTagInfo[]>('list_git_tags', { repoPath: currentRepoPath });
      set({ tags: res || [] });
    } catch (err) {
      console.warn('Failed to fetch tags:', err);
    }
  },

  createTag: async (name: string, commitRef?: string, message?: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('create_git_tag', {
      repoPath: currentRepoPath,
      tagName: name,
      commitRef: commitRef || null,
      message: message || null,
    });
    await get().fetchTags();
  },

  deleteTag: async (name: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('delete_git_tag', { repoPath: currentRepoPath, tagName: name });
    await get().fetchTags();
  },

  createBranch: async (name: string, startPoint?: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('create_git_branch', {
      repoPath: currentRepoPath,
      branchName: name,
      startPoint: startPoint || null,
    });
  },

  deleteBranch: async (name: string, force = false) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('delete_git_branch', { repoPath: currentRepoPath, branchName: name, force });
  },

  renameBranch: async (oldName: string, newName: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('rename_git_branch', { repoPath: currentRepoPath, oldName, newName });
  },
});

