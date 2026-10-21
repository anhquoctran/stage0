import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../../git/store/useGitStore';
import { type VirtualMrSession } from '../types/VirtualMrSession';
import { type VirtualMrStatus } from '../types/VirtualMrStatus';
import { type VirtualMrDiscussion } from '../types/VirtualMrDiscussion';
import { type VirtualMrCommit } from '../types/VirtualMrCommit';
import { type RepoLabel } from '../types/RepoLabel';
import { type RepoSettings } from '../types/RepoSettings';
import { AVAILABLE_AI_BOTS } from '../types/virtualMr';
import type { VirtualMrState } from '../types/VirtualMrState';
import { fromDbDiscussion } from '../utils/fromDbDiscussion';
import { flushSessionWrites } from '../services/sessionPersistence';
import { persistSession, openExistingVirtualMr } from '../utils/virtualMrSessionHelpers';
import { createDiscussionSlice } from './createDiscussionSlice';
import { createRepoSettingsSlice } from './createRepoSettingsSlice';
import { createSessionSlice } from './createSessionSlice';
import { createDraftMrSlice } from './createDraftMrSlice';

let repoDataRequestVersion = 0;
let repoMetadataRequestVersion = 0;

export const useVirtualMrStore = create<VirtualMrState>((set, get) => ({
  currentRepoId: null,
  currentRepoPath: null,
  repoSettings: null,
  repoLabels: [],
  remotesDetailed: [],
  tags: [],

  isRepoSettingsOpen: false,
  repoSettingsActiveTab: 'remotes',
  openRepoSettings: (tab = 'remotes') => set({ isRepoSettingsOpen: true, repoSettingsActiveTab: tab }),
  closeRepoSettings: () => set({ isRepoSettingsOpen: false }),
  setRepoSettingsActiveTab: (tab) => set({ repoSettingsActiveTab: tab }),

  sessions: [],
  activeSessionId: null,
  pendingDescriptionEditSessionId: null,
  closedSessionTabIds: [],
  isLoadingSessions: false,
  isMrListOpen: false,
  setIsMrListOpen: (isMrListOpen) => set({ isMrListOpen }),
  activeMrTab: 'overview',
  setActiveMrTab: (tab) => set({ activeMrTab: tab }),
  draftMr: null,
  isDraftActive: false,

  getActiveSession: () => {
    const { sessions, activeSessionId } = get();
    return sessions.find((s) => s.id === activeSessionId) || null;
  },
  consumeDescriptionEditRequest: (sessionId) => {
    const current = get().pendingDescriptionEditSessionId;
    if (current !== sessionId) return false;
    set({ pendingDescriptionEditSessionId: null });
    return true;
  },

  loadRepoData: async (repoId: string, repoPath: string, availableBranches: string[], defaultBase?: string) => {
    const requestVersion = ++repoDataRequestVersion;
    const repoChanged =
      get().currentRepoId !== repoId || get().currentRepoPath !== repoPath;
    set({
      currentRepoId: repoId,
      currentRepoPath: repoPath,
      isLoadingSessions: true,
      ...(repoChanged
        ? {
            repoSettings: null,
            repoLabels: [],
            sessions: [],
            activeSessionId: null,
            pendingDescriptionEditSessionId: null,
            closedSessionTabIds: [],
            isMrListOpen: false,
            draftMr: null,
            isDraftActive: false,
          }
        : {}),
    });

    try {
      // 1. Load Repo Settings
      let settings: RepoSettings | null = null;
      try {
        const dbSettings = await invoke<any>('get_repo_settings', { repoId });
        if (dbSettings) {
          settings = {
            repoId: dbSettings.repo_id,
            defaultBaseBranch: dbSettings.default_base_branch,
            inheritGlobalAgents: Boolean(dbSettings.inherit_global_agents),
            customAgentRules: dbSettings.custom_agent_rules || '',
            activeAgentIds: AVAILABLE_AI_BOTS.map((b) => b.id),
          };
        }
      } catch (err) {
        console.warn('Failed to load repo settings:', err);
      }

      if (!settings) {
        const smartBase =
          defaultBase ||
          (availableBranches.includes('main') ? 'main' : undefined) ||
          (availableBranches.includes('origin/main') ? 'origin/main' : undefined) ||
          (availableBranches.includes('master') ? 'master' : undefined) ||
          (availableBranches.includes('origin/master') ? 'origin/master' : undefined) ||
          availableBranches[0] ||
          'HEAD';
        settings = {
          repoId,
          defaultBaseBranch: smartBase,
          inheritGlobalAgents: true,
          customAgentRules: '',
          activeAgentIds: AVAILABLE_AI_BOTS.map((b) => b.id),
        };
      }

      // 2. Load Labels
      let labels: RepoLabel[] = [];
      try {
        const dbLabels = await invoke<any[]>('list_repo_labels', { repoId });
        labels = (dbLabels || []).map((l) => ({
          id: l.id,
          repoId: l.repo_id,
          name: l.name,
          color: l.color,
          description: l.description || undefined,
        }));
      } catch (err) {
        console.warn('Failed to load repo labels:', err);
      }

      // 3. Load User Identity
      let userName = 'Local User';
      let userEmail = 'user@local.stage0';
      try {
        const [uName, uEmail] = await invoke<[string, string]>('get_git_user_identity_cmd', { repoPath });
        if (uName) userName = uName;
        if (uEmail) userEmail = uEmail;
      } catch {}

      // 4. Load Sessions (Parallelized to eliminate waterfall)
      let sessions: VirtualMrSession[] = [];
      try {
        await flushSessionWrites();
        const dbSessions = await invoke<any[]>('list_virtual_mr_sessions', { repoId });
        if (dbSessions && dbSessions.length > 0) {
          sessions = await Promise.all(
            dbSessions.map(async (ds) => {
              const [discRes, commitRes] = await Promise.allSettled([
                invoke<any[]>('list_mr_discussions', { sessionId: ds.id }),
                invoke<any[]>('get_commits_between_refs', {
                  repoPath,
                  base: ds.base_branch,
                  compare: ds.compare_branch,
                }),
              ]);

              let discussions: VirtualMrDiscussion[] = [];
              if (discRes.status === 'fulfilled' && discRes.value) {
                discussions = discRes.value.map(fromDbDiscussion);
              }

              let commits: VirtualMrCommit[] = [];
              if (commitRes.status === 'fulfilled' && commitRes.value) {
                commits = commitRes.value.map((c: any) => ({
                  hash: c.hash,
                  shortHash: c.short_hash,
                  subject: c.subject,
                  body: c.body,
                  authorName: c.author_name,
                  authorEmail: c.author_email,
                  authoredDate: c.authored_date,
                }));
              }

              const attachedLabels = labels.filter((l) => (ds.label_ids || []).includes(l.id));

              const rawDesc = ds.description || '';
              const isLegacy =
                rawDesc.includes('Virtual MR comparing') &&
                (rawDesc.includes('Review code changes') || rawDesc.includes('Check security'));
              const cleanDesc = isLegacy ? '' : rawDesc;

              return {
                id: ds.id,
                repoId: ds.repo_id,
                title: ds.title,
                description: cleanDesc,
                baseBranch: ds.base_branch,
                compareBranch: ds.compare_branch,
                status: (ds.status === 'approved' ? 'open' : (ds.status as VirtualMrStatus)) || 'open',
                assignee: {
                  name: ds.assignee_name || userName,
                  email: ds.assignee_email || userEmail,
                },
                reviewers: (ds.reviewers || []).map((reviewer: any) => ({
                  agentId: reviewer.agent_id,
                  agentName: reviewer.agent_name,
                  reviewStatus: reviewer.review_status === 'reviewing'
                    ? 'pending'
                    : reviewer.review_status || 'pending',
                  assignedAt: reviewer.assigned_at,
                })),
                labels: attachedLabels,
                discussions,
                commits,
                isPinned: Boolean(ds.is_pinned),
                createdAt: ds.created_at,
                updatedAt: ds.updated_at,
              };
            })
          );
        }
      } catch (err) {
        console.warn('Failed to load sessions from db:', err);
      }

      if (requestVersion !== repoDataRequestVersion) return;
      const closedSessionTabIds = get().closedSessionTabIds;
      const openTabs = sessions.filter((session) => !closedSessionTabIds.includes(session.id));
      let activeSessionId = get().activeSessionId;
      if (openTabs.length > 0) {
        if (!activeSessionId || !openTabs.some((s) => s.id === activeSessionId)) {
          activeSessionId = openTabs[0].id;
        }
      } else {
        activeSessionId = null;
      }

      set({
        repoSettings: settings,
        repoLabels: labels,
        sessions,
        activeSessionId,
        isLoadingSessions: false,
      });

      // Background load remotes & tags
      get().fetchRemotesDetailed();
      get().fetchTags();

    } catch (err) {
      console.error('loadRepoData error:', err);
      if (requestVersion === repoDataRequestVersion) set({ isLoadingSessions: false });
    }
  },

  refreshRepoMetadata: async (repoId: string) => {
    const requestVersion = ++repoMetadataRequestVersion;
    const [settingsResult, labelsResult] = await Promise.allSettled([
      invoke<any>('get_repo_settings', { repoId }),
      invoke<any[]>('list_repo_labels', { repoId }),
    ]);

    if (requestVersion !== repoMetadataRequestVersion || get().currentRepoId !== repoId) return;

    const updates: Partial<Pick<VirtualMrState, 'repoSettings' | 'repoLabels'>> = {};
    if (settingsResult.status === 'fulfilled') {
      const dbSettings = settingsResult.value;
      const currentSettings = get().repoSettings;
      if (dbSettings) {
        updates.repoSettings = {
          repoId: dbSettings.repo_id,
          defaultBaseBranch: dbSettings.default_base_branch || currentSettings?.defaultBaseBranch || 'HEAD',
          inheritGlobalAgents: Boolean(dbSettings.inherit_global_agents),
          customAgentRules: dbSettings.custom_agent_rules || '',
          activeAgentIds: currentSettings?.activeAgentIds || AVAILABLE_AI_BOTS.map((bot) => bot.id),
          customReviewers: currentSettings?.customReviewers,
        };
      }
    } else {
      console.warn('Failed to refresh repository settings:', settingsResult.reason);
    }

    if (labelsResult.status === 'fulfilled') {
      updates.repoLabels = (labelsResult.value || []).map((label) => ({
        id: label.id,
        repoId: label.repo_id,
        name: label.name,
        color: label.color,
        description: label.description || undefined,
      }));
    } else {
      console.warn('Failed to refresh repository labels:', labelsResult.reason);
    }

    if (Object.keys(updates).length > 0) set(updates);
  },

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
    const base = baseBranch || repoSettings?.defaultBaseBranch || gitStore.baseBranch || smartFallback;
    const compare = compareBranch || gitStore.compareBranch || availableBranches.find((b: string) => b !== base) || base;
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

  ...createDraftMrSlice(set, get),
  ...createSessionSlice(set, get),
  ...createRepoSettingsSlice(set, get),
  ...createDiscussionSlice(set, get),
}));
