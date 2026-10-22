import { invoke } from '@tauri-apps/api/core';
import type { StateCreator } from 'zustand';
import { useGitStore } from '../../../git/store/useGitStore';
import { type VirtualMrCommit } from '../../types/VirtualMrCommit';
import { type VirtualMrSession } from '../../types/VirtualMrSession';
import type { VirtualMrState } from '../../types/VirtualMrState';
import { openExistingVirtualMr, persistSession } from '../../utils/virtualMrSessionHelpers';

export const createSessionCreationSlice: StateCreator<
  VirtualMrState,
  [],
  [],
  Pick<VirtualMrState, 'createSession'>
> = (set, get) => ({
  createSession: async (baseBranch, compareBranch, customTitle) => {
    let { currentRepoId, currentRepoPath, repoSettings, sessions } = get();

    if (!currentRepoId || !currentRepoPath) {
      const gitStore = useGitStore.getState();
      if (gitStore.currentRepo) {
        currentRepoId = gitStore.currentRepo.id;
        currentRepoPath = gitStore.currentRepo.local_path;
        set({ currentRepoId, currentRepoPath });
      }
    }

    if (!currentRepoId || !currentRepoPath) {
      console.warn('createSession: Cannot create session because no repository is active.');
      useGitStore.getState().showToast('No active repository to create Virtual MR');
      return '';
    }

    const gitStore = useGitStore.getState();
    const availableBranches = [
      ...(gitStore.branches?.local || []),
      ...(gitStore.branches?.remote || []),
    ];
    const smartFallback =
      (availableBranches.includes('main') ? 'main' : undefined) ||
      (availableBranches.includes('origin/main') ? 'origin/main' : undefined) ||
      (availableBranches.includes('master') ? 'master' : undefined) ||
      (availableBranches.includes('origin/master') ? 'origin/master' : undefined) ||
      availableBranches[0] ||
      'HEAD';
    const base =
      baseBranch || repoSettings?.defaultBaseBranch || gitStore.baseBranch || smartFallback;
    const compare =
      compareBranch ||
      gitStore.compareBranch ||
      availableBranches.find((b: string) => b !== base) ||
      base;
    const title = customTitle || `${compare} → ${base}`;
    const newId = `vmr-${Date.now()}`;

    let commits: VirtualMrCommit[] = [];
    try {
      const raw = await invoke<any[]>('get_commits_between_refs', {
        repoPath: currentRepoPath,
        base,
        compare,
      });
      commits = (raw || []).map((c) => ({
        hash: c.hash,
        shortHash: c.short_hash,
        subject: c.subject,
        body: c.body,
        authorName: c.author_name,
        authorEmail: c.author_email,
        authoredDate: c.authored_date,
      }));
    } catch (e) {
      console.warn('Failed to get commits between refs:', e);
    }

    const session: VirtualMrSession = {
      id: newId,
      repoId: currentRepoId,
      title,
      description: '',
      baseBranch: base,
      compareBranch: compare,
      status: 'open',
      assignee: sessions[0]?.assignee || { name: 'Local User', email: 'user@local.stage0' },
      reviewers: [],
      labels: [],
      discussions: [],
      commits,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const outcome = await persistSession(session, get);
      if (outcome.outcome === 'duplicate_open') {
        openExistingVirtualMr(outcome, get);
        return '';
      }
    } catch (error) {
      console.error('Failed to persist session:', error);
      gitStore.showToast('Could not save this Virtual MR to the database. Please try again.');
      return '';
    }

    if (get().currentRepoId !== currentRepoId) return newId;
    const newSessions = [...get().sessions, session];
    set({
      sessions: newSessions,
      activeSessionId: newId,
      pendingDescriptionEditSessionId: newId,
      closedSessionTabIds: get().closedSessionTabIds.filter((id) => id !== newId),
    });

    try {
      await gitStore.setBranchComparison(base, compare);
    } catch (err) {
      console.warn('Failed to sync branches with gitStore:', err);
    }

    gitStore.showToast(`Created Virtual MR: ${title}`);

    return newId;
  },
});
