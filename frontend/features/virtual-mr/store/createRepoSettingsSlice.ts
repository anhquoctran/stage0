import { commitRepositorySettings } from '../services/repositorySettingsDocuments';
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
    const repoId = get().currentRepoId;
    if (!repoId) return;
    const id = crypto.randomUUID();
    const saved = await commitRepositorySettings(repoId, (current) => ({
      labels: [...current.labels, { id, name, color, description: description || null }],
    }));
    const label = saved.labels[saved.settings.labels.findIndex((label) => label.id === id)];
    return { id: label.id, repoId, name: label.name, color: label.color, description: label.description || undefined };
  },

  updateRepoLabel: async (label: RepoLabel) => {
    await commitRepositorySettings(label.repoId, (current, doc) => {
      const index = doc.labels.findIndex((item) => item.id === label.id);
      if (index < 0) throw new Error('Label no longer exists');
      return { labels: current.labels.map((item, i) => i === index
        ? { ...item, name: label.name, color: label.color, description: label.description || null } : item) };
    });
  },

  deleteRepoLabel: async (labelId: string) => {
    const repoId = get().currentRepoId;
    if (!repoId) return;
    await commitRepositorySettings(repoId, (current, doc) => {
      const index = doc.labels.findIndex((item) => item.id === labelId);
      if (index < 0) throw new Error('Label no longer exists');
      return { labels: current.labels.filter((_, i) => i !== index) };
    });
  },

  loadPresetLabels: async () => {
    const repoId = get().currentRepoId;
    if (!repoId) return;
    await commitRepositorySettings(repoId, (current) => ({ labels: [
      ...current.labels,
      ...PRESET_REPO_LABELS.filter((preset) => !current.labels.some((label) => label.name === preset.name))
        .map((preset) => ({ ...preset, id: crypto.randomUUID() })),
    ] }));
  },

  saveRepoSettings: async (updates: Partial<RepoSettings>) => {
    const { repoSettings, currentRepoId } = get();
    if (!currentRepoId || !repoSettings) throw new Error('Repository settings unavailable');
    if (repoSettings.validationError) throw new Error(repoSettings.validationError);
    await commitRepositorySettings(currentRepoId, () => ({
      ...(updates.defaultBaseBranch !== undefined ? { defaultBaseBranch: updates.defaultBaseBranch } : {}),
      ...(updates.inheritGlobalAgents !== undefined ? { inheritGlobalAgents: updates.inheritGlobalAgents } : {}),
      ...(updates.customAgentRules !== undefined ? { customAgentRules: updates.customAgentRules } : {}),
    }), updates.revision ?? repoSettings.revision);
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

