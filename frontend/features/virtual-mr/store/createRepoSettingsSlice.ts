import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

import { type RepoLabel } from '../types/RepoLabel';
import { type RepoSettings } from '../types/RepoSettings';
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
      await getApplicationServices().repositorySettings.createRepoLabel({
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
      await getApplicationServices().repositorySettings.updateRepoLabel({
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
      await getApplicationServices().repositorySettings.deleteRepoLabel({ id: labelId });
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
      await getApplicationServices().repositorySettings.saveRepoSettings({
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
      const res = await getApplicationServices().gitRemotes.listGitRemotesDetailed({ repoPath: currentRepoPath });
      set({ remotesDetailed: res || [] });
    } catch (err) {
      console.warn('Failed to fetch remotes detailed:', err);
    }
  },

  addRemote: async (name: string, url: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await getApplicationServices().gitRemotes.addGitRemote({ repoPath: currentRepoPath, name, url });
    await get().fetchRemotesDetailed();
  },

  removeRemote: async (name: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await getApplicationServices().gitRemotes.removeGitRemote({ repoPath: currentRepoPath, name });
    await get().fetchRemotesDetailed();
  },

  setRemoteUrl: async (name: string, url: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await getApplicationServices().gitRemotes.setGitRemoteUrl({ repoPath: currentRepoPath, name, url });
    await get().fetchRemotesDetailed();
  },

  testRemote: async (remoteOrUrl: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return 'No repo open';
    return await getApplicationServices().gitRemotes.testGitRemote({ repoPath: currentRepoPath, remoteOrUrl });
  },

  // Tags & Branches
  fetchTags: async () => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    try {
      const res = await getApplicationServices().gitRemotes.listGitTags({ repoPath: currentRepoPath });
      set({ tags: res || [] });
    } catch (err) {
      console.warn('Failed to fetch tags:', err);
    }
  },

  createTag: async (name: string, commitRef?: string, message?: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await getApplicationServices().gitRemotes.createGitTag({
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
    await getApplicationServices().gitRemotes.deleteGitTag({ repoPath: currentRepoPath, tagName: name });
    await get().fetchTags();
  },

  createBranch: async (name: string, startPoint?: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await getApplicationServices().gitRemotes.createGitBranch({
      repoPath: currentRepoPath,
      branchName: name,
      startPoint: startPoint || null,
    });
  },

  deleteBranch: async (name: string, force = false) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await getApplicationServices().gitRemotes.deleteGitBranch({ repoPath: currentRepoPath, branchName: name, force });
  },

  renameBranch: async (oldName: string, newName: string) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await getApplicationServices().gitRemotes.renameGitBranch({ repoPath: currentRepoPath, oldName, newName });
  },
});

