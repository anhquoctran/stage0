import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore } from '../../git/store/useGitStore';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { type VirtualMrSession } from '../types/VirtualMrSession';
import { type VirtualMrStatus } from '../types/VirtualMrStatus';
import { type ReviewerState } from '../types/ReviewerState';
import { type VirtualMrDiscussion } from '../types/VirtualMrDiscussion';
import { type VirtualMrComment } from '../types/VirtualMrComment';
import { type VirtualMrReviewer } from '../types/VirtualMrReviewer';
import { type VirtualMrCommit } from '../types/VirtualMrCommit';
import { type RepoLabel } from '../types/RepoLabel';
import { type RepoSettings } from '../types/RepoSettings';
import { type GitRemoteDetail } from '../types/GitRemoteDetail';
import { type GitTagInfo } from '../types/GitTagInfo';
import { AVAILABLE_AI_BOTS, PRESET_REPO_LABELS } from '../types/virtualMr';
import { type NewMrDraft } from '../types/NewMrDraft';
import type { VirtualMrState } from '../types/VirtualMrState';
import { AI_REVIEW_UNAVAILABLE } from '../../ai/constants/runtimeAvailability';
import type { DbDiscussion } from '../types/DbDiscussion';
import { fromDbDiscussion } from '../utils/fromDbDiscussion';
import { enqueueSessionWrite, flushSessionWrites, pendingSessionSnapshot, saveSessionSnapshot } from '../services/sessionPersistence';

let draftBranchRequestVersion = 0;
let repoDataRequestVersion = 0;
let repoMetadataRequestVersion = 0;

const persistSession = (session: VirtualMrSession): Promise<void> =>
  enqueueSessionWrite(session.id, () => {
    // A metadata save may have finished while this write was queued.
    const current = useVirtualMrStore.getState().sessions.find((item) => item.id === session.id);
    return saveSessionSnapshot(current ?? pendingSessionSnapshot(session.id) ?? session);
  });

const updateSessionMetadata = async (
  sessionId: string,
  update: (session: VirtualMrSession) => Partial<Pick<VirtualMrSession, 'reviewers' | 'labels' | 'status'>> | null,
): Promise<void> => {
  const original = useVirtualMrStore.getState().sessions.find((item) => item.id === sessionId);
  if (!original) return;
  try {
    await enqueueSessionWrite(sessionId, async () => {
      const session = useVirtualMrStore.getState().sessions.find((item) => item.id === sessionId)
        ?? pendingSessionSnapshot(sessionId) ?? original;
      const changes = update(session);
      if (!changes) return;
      const updatedAt = new Date().toISOString();
      await saveSessionSnapshot({ ...session, ...changes, updatedAt });
      // Publish only after SQLite confirms the selection. Merge with current
      // state so another edit or a repository switch cannot be overwritten.
      useVirtualMrStore.setState((state) => ({
        sessions: state.sessions.map((item) => item.id === sessionId
          ? { ...item, ...changes, updatedAt }
          : item),
      }));
    });
  } catch (error) {
    console.error('Failed to save Virtual MR selections:', error);
    useGitStore.getState().showToast('Could not save MR reviewers or labels. Please try again.');
  }
};

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error) || String(error);
  } catch {
    return String(error);
  }
};

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
    if (get().pendingDescriptionEditSessionId !== sessionId) return false;
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
              // Load discussions and commits concurrently for this session
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
                discussions = discRes.value.map((d: any) => ({
                  id: d.id,
                  sessionId: d.session_id,
                  filePath: d.file_path,
                  diffSide: d.diff_side,
                  lineNumber: d.line_number,
                  commitId: d.commit_id,
                  isResolved: Boolean(d.is_resolved),
                  resolveType: d.resolve_type || 'manual',
                  resolvedBy: d.resolved_by,
                  resolvedAt: d.resolved_at,
                  verificationStatus: d.verification_status || 'none',
                  verifiedByBot: d.verified_by_bot,
                  verifiedAt: d.verified_at,
                  createdAt: d.created_at,
                  comments: (d.comments || []).map((c: any) => ({
                    id: c.id,
                    discussionId: c.discussion_id,
                    authorType: c.author_type,
                    authorId: c.author_id,
                    authorName: c.author_name,
                    authorAvatar: c.author_avatar,
                    body: c.body,
                    reviewAction: c.review_action,
                    createdAt: c.created_at,
                    updatedAt: c.updated_at,
                  })),
                }));
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

    // Auto-recover repository context from useGitStore if not set in virtualMrStore
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
      await persistSession(session);
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

    // Sync with gitStore so diff immediately loads for this MR
    try {
      await gitStore.setBranchComparison(base, compare);
    } catch (err) {
      console.warn('Failed to sync branches with gitStore:', err);
    }

    gitStore.showToast(`Created Virtual MR: ${title}`);

    return newId;
  },

  openNewMrDraft: async (initialBase, initialCompare) => {
    const requestVersion = ++draftBranchRequestVersion;
    let { currentRepoId, currentRepoPath, repoSettings } = get();

    if (!currentRepoId || !currentRepoPath) {
      const gitStore = useGitStore.getState();
      if (gitStore.currentRepo) {
        currentRepoId = gitStore.currentRepo.id;
        currentRepoPath = gitStore.currentRepo.local_path;
        set({ currentRepoId, currentRepoPath });
      }
    }

    if (!currentRepoPath) {
      useGitStore.getState().showToast('No active repository to create Virtual MR');
      return;
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
    const base = initialBase || repoSettings?.defaultBaseBranch || gitStore.baseBranch || smartFallback;
    const compare = initialCompare || gitStore.compareBranch || availableBranches.find((b: string) => b !== base) || base;

    const newDraft: NewMrDraft = {
      baseBranch: base,
      compareBranch: compare,
      title: `${compare} → ${base}`,
      description: '',
      selectedBots: [],
      selectedLabels: [],
      commits: [],
      isCommitsLoading: true,
      commitsError: null,
    };

    set({ draftMr: newDraft, isDraftActive: true, activeSessionId: null });

    // Sync with gitStore so diff immediately loads
    try {
      await gitStore.setBranchComparison(base, compare);
    } catch {}

    const isCurrentDraftRequest = () => {
      const currentDraft = get().draftMr;
      return requestVersion === draftBranchRequestVersion
        && currentDraft?.baseBranch === base
        && currentDraft.compareBranch === compare;
    };
    if (!isCurrentDraftRequest()) return;

    // Load commits
    try {
      const raw = await invoke<any[]>('get_commits_between_refs', {
        repoPath: currentRepoPath,
        base,
        compare,
      });
      const commits: VirtualMrCommit[] = (raw || []).map((c) => ({
        hash: c.hash,
        shortHash: c.short_hash,
        subject: c.subject,
        body: c.body,
        authorName: c.author_name,
        authorEmail: c.author_email,
        authoredDate: c.authored_date,
      }));

      if (!isCurrentDraftRequest()) return;
      set((state) => {
        if (!state.draftMr || state.draftMr.baseBranch !== base || state.draftMr.compareBranch !== compare) return {};
        const title = commits.length > 0 && commits[0].subject ? commits[0].subject : `${compare} → ${base}`;
        return {
          draftMr: {
            ...state.draftMr,
            commits,
            title,
            isCommitsLoading: false,
          },
        };
      });
    } catch (error: unknown) {
      if (!isCurrentDraftRequest()) return;
      set((state) => (state.draftMr ? {
        draftMr: {
          ...state.draftMr,
          isCommitsLoading: false,
          commitsError: getErrorMessage(error),
        },
      } : {}));
    }
  },

  updateDraftMr: (updates) => {
    set((state) => (state.draftMr ? { draftMr: { ...state.draftMr, ...updates } } : {}));
  },

  changeDraftBranches: async (base, compare) => {
    const { currentRepoPath, draftMr } = get();
    if (!draftMr || !currentRepoPath) return;
    const requestVersion = ++draftBranchRequestVersion;
    const hadDefaultTitle = draftMr.title === `${draftMr.compareBranch} → ${draftMr.baseBranch}`;
    const isCurrentDraftRequest = () => {
      const currentDraft = get().draftMr;
      return requestVersion === draftBranchRequestVersion
        && currentDraft?.baseBranch === base
        && currentDraft.compareBranch === compare;
    };

    set((state) => ({
      draftMr: state.draftMr
        ? {
            ...state.draftMr,
            baseBranch: base,
            compareBranch: compare,
            commits: [],
            isCommitsLoading: true,
            commitsError: null,
          }
        : null,
    }));

    const gitStore = useGitStore.getState();
    try {
      await gitStore.setBranchComparison(base, compare);
    } catch {}
    if (!isCurrentDraftRequest()) return;

    try {
      const raw = await invoke<any[]>('get_commits_between_refs', {
        repoPath: currentRepoPath,
        base,
        compare,
      });
      const commits: VirtualMrCommit[] = (raw || []).map((c) => ({
        hash: c.hash,
        shortHash: c.short_hash,
        subject: c.subject,
        body: c.body,
        authorName: c.author_name,
        authorEmail: c.author_email,
        authoredDate: c.authored_date,
      }));

      if (!isCurrentDraftRequest()) return;
      set((state) => {
        if (!state.draftMr || state.draftMr.baseBranch !== base || state.draftMr.compareBranch !== compare) return {};
        const defaultTitle = commits.length > 0 && commits[0].subject ? commits[0].subject : `${compare} → ${base}`;
        return {
          draftMr: {
            ...state.draftMr,
            commits,
            title: hadDefaultTitle ? defaultTitle : state.draftMr.title,
            isCommitsLoading: false,
            commitsError: null,
          },
        };
      });
    } catch (error: unknown) {
      if (!isCurrentDraftRequest()) return;
      set((state) => (state.draftMr ? {
        draftMr: {
          ...state.draftMr,
          isCommitsLoading: false,
          commitsError: getErrorMessage(error),
        },
      } : {}));
    }
  },

  closeNewMrDraft: () => {
    draftBranchRequestVersion += 1;
    const { sessions } = get();
    set({ draftMr: null, isDraftActive: false });
    if (sessions.length > 0) {
      const target = sessions[0];
      set({ activeSessionId: target.id });
      const gitStore = useGitStore.getState();
      gitStore.setBranchComparison(target.baseBranch, target.compareBranch);
    }
  },

  activateDraftMr: () => {
    const { draftMr } = get();
    set({ isDraftActive: true, activeSessionId: null });
    if (draftMr) {
      const gitStore = useGitStore.getState();
      gitStore.setBranchComparison(draftMr.baseBranch, draftMr.compareBranch);
    }
  },

  submitNewMrDraft: async () => {
    const { draftMr, currentRepoId, currentRepoPath, repoLabels, sessions } = get();
    if (!draftMr || !currentRepoId || !currentRepoPath) return '';

    const newId = `vmr-${Date.now()}`;
    const title = draftMr.title.trim() || `${draftMr.compareBranch} → ${draftMr.baseBranch}`;

    const newSession: VirtualMrSession = {
      id: newId,
      repoId: currentRepoId,
      title,
      description: draftMr.description,
      baseBranch: draftMr.baseBranch,
      compareBranch: draftMr.compareBranch,
      status: 'open',
      assignee: sessions[0]?.assignee || { name: 'Local User', email: 'user@local.stage0' },
      reviewers: (() => {
        const repoId = currentRepoId;
        const allBots = [
          ...useBotReviewersStore.getState().globalReviewers,
          ...(repoId ? useBotReviewersStore.getState().repoCustomReviewers[repoId] || [] : []),
        ];
        return draftMr.selectedBots.map((botId) => {
          const bot = allBots.find((b) => b.id === botId) || AVAILABLE_AI_BOTS.find((b) => b.id === botId);
          return {
            agentId: botId,
            agentName: bot?.name || botId,
            reviewStatus: 'pending' as const,
            assignedAt: new Date().toISOString(),
          };
        });
      })(),
      labels: (repoLabels || []).filter((l) => draftMr.selectedLabels.includes(l.id)),
      discussions: [],
      commits: draftMr.commits,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await persistSession(newSession);
    } catch (err) {
      console.error('Failed to save virtual MR to database:', err);
      useGitStore.getState().showToast('Could not save this Virtual MR to the database. Your draft is still available; please try again.');
      return '';
    }

    const currentState = get();
    if (currentState.currentRepoId !== currentRepoId) return newId;
    set({
      sessions: [...currentState.sessions, newSession],
      activeSessionId: newId,
      pendingDescriptionEditSessionId: newId,
      closedSessionTabIds: currentState.closedSessionTabIds.filter((id) => id !== newId),
      draftMr: null,
      isDraftActive: false,
    });

    useGitStore.getState().showToast(`Created Virtual MR: ${title}`);
    return newId;
  },

  switchSession: (sessionId) => {
    set((state) => ({
      activeSessionId: sessionId,
      isDraftActive: false,
      closedSessionTabIds: state.closedSessionTabIds.filter((id) => id !== sessionId),
    }));
  },

  closeSession: async (sessionId) => {
    const { sessions, activeSessionId, draftMr, isDraftActive, closedSessionTabIds } = get();
    if (!sessions.some((session) => session.id === sessionId)) return;

    const closedTabs = [...new Set([...closedSessionTabIds, sessionId])];
    const remainingTabs = sessions.filter((session) => !closedTabs.includes(session.id));
    let nextActive = activeSessionId;
    let nextDraftActive = isDraftActive;

    if (!isDraftActive && activeSessionId === sessionId) {
      if (remainingTabs.length > 0) {
        nextActive = remainingTabs[0].id;
      } else if (draftMr) {
        nextActive = null;
        nextDraftActive = true;
      } else {
        nextActive = null;
      }
    }

    set({ closedSessionTabIds: closedTabs, activeSessionId: nextActive, isDraftActive: nextDraftActive });

    if (nextDraftActive && draftMr) {
      get().activateDraftMr();
    } else if (nextActive) {
      const nextSession = sessions.find((s) => s.id === nextActive);
      if (nextSession) {
        useGitStore.getState().setBranchComparison(nextSession.baseBranch, nextSession.compareBranch);
      }
    }
  },

  updateSessionStatus: async (sessionId, status) => {
    const { sessions, currentRepoId } = get();
    const updated = sessions.map((s) => (s.id === sessionId ? { ...s, status, updatedAt: new Date().toISOString() } : s));
    set({ sessions: updated });

    const target = updated.find((s) => s.id === sessionId);
    if (target && currentRepoId) {
      try {
        await persistSession(target);
      } catch {}
    }
  },

  setReviewerReviewStatus: async (sessionId, agentId, reviewStatus: ReviewerState) => {
    await updateSessionMetadata(sessionId, (session) => {
      const current = session.reviewers.find((reviewer) => reviewer.agentId === agentId);
      if (!current) return null;
      const reviewers = session.reviewers.map((reviewer) => reviewer.agentId === agentId
        ? { ...reviewer, reviewStatus }
        : reviewer);
      const allReviewersApproved = reviewers.length > 0 && reviewers.every((reviewer) => reviewer.reviewStatus === 'approved');
      const hasOpenDiscussions = session.discussions.some((discussion) => !discussion.isResolved);
      const status = reviewStatus === 'reviewing'
        ? (session.status === 'resolved' ? 'open' : session.status)
        : session.status === 'closed'
          ? 'closed'
          : allReviewersApproved && !hasOpenDiscussions
            ? 'resolved'
            : 'open';
      if (current.reviewStatus === reviewStatus && session.status === status) return null;
      return { reviewers, status };
    });
  },

  resetReviewerReviews: async (sessionId) => {
    await updateSessionMetadata(sessionId, (session) => ({
      status: 'open',
      reviewers: session.reviewers.map((reviewer) => ({ ...reviewer, reviewStatus: 'pending' })),
    }));
  },

  invalidateReviewerApprovals: async (sessionId) => {
    await updateSessionMetadata(sessionId, (session) => {
      const status = session.status === 'resolved' ? 'open' : session.status;
      if (session.reviewers.every((reviewer) => reviewer.reviewStatus === 'pending') && session.status === status) return null;
      return {
        status,
        reviewers: session.reviewers.map((reviewer) => ({ ...reviewer, reviewStatus: 'pending' })),
      };
    });
  },

  tryResolveSession: async (sessionId) => {
    const session = get().sessions.find((item) => item.id === sessionId);
    if (!session || session.status !== 'open' || session.reviewers.length === 0) return;
    if (session.reviewers.some((reviewer) => reviewer.reviewStatus !== 'approved')) return;
    if (session.discussions.some((discussion) => !discussion.isResolved)) return;
    await get().updateSessionStatus(sessionId, 'resolved');
  },

  updateSessionDetails: async (sessionId, title, description) => {
    const { sessions, currentRepoId } = get();
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, title, description, updatedAt: new Date().toISOString() } : s
    );
    set({ sessions: updated });

    const target = updated.find((s) => s.id === sessionId);
    if (target && currentRepoId) {
      try {
        await persistSession(target);
      } catch {}
    }
  },

  applyReviewGeneratedDescription: async (sessionId, description) => {
    const session = get().sessions.find((item) => item.id === sessionId);
    if (session && session.description !== description) {
      await get().updateSessionDetails(sessionId, session.title, description);
    }
  },

  updateSessionBranches: async (sessionId, base, compare) => {
    const { currentRepoPath } = get();
    let commits: VirtualMrCommit[] = [];
    if (currentRepoPath) {
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
      } catch {}
    }

    const updated = get().sessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            baseBranch: base,
            compareBranch: compare,
            title: `${compare} → ${base}`,
            status: (s.status === 'closed' ? 'closed' : 'open') as VirtualMrStatus,
            reviewers: s.reviewers.map((reviewer) => ({ ...reviewer, reviewStatus: 'pending' as const })),
            commits,
            updatedAt: new Date().toISOString(),
          }
        : s
    );
    set({ sessions: updated });

    const target = updated.find((s) => s.id === sessionId);
    const { currentRepoId } = get();
    if (target && currentRepoId) {
      try {
        await persistSession(target);
      } catch (err) {
        console.warn('Failed to persist session branch changes:', err);
      }
    }
  },

  assignReviewerBot: async (sessionId, botId) => {
    const { currentRepoId } = get();
    const allBots = [
      ...useBotReviewersStore.getState().globalReviewers,
      ...(currentRepoId ? useBotReviewersStore.getState().repoCustomReviewers[currentRepoId] || [] : []),
    ];
    const bot = allBots.find((b) => b.id === botId) || AVAILABLE_AI_BOTS.find((b) => b.id === botId);
    if (!bot) return;

    await updateSessionMetadata(sessionId, (session) => {
      if (session.reviewers.some((r) => r.agentId === botId)) return null;
      const newReviewer: VirtualMrReviewer = {
        agentId: bot.id,
        agentName: bot.name,
        reviewStatus: 'pending',
        assignedAt: new Date().toISOString(),
      };
      return {
        status: session.status === 'closed' ? 'closed' : 'open',
        reviewers: [...session.reviewers.map((reviewer) => ({ ...reviewer, reviewStatus: 'pending' as const })), newReviewer],
      };
    });
    void import('../../review/services/assignedReviewService')
      .then(({ reReviewAssignedSession }) => reReviewAssignedSession(sessionId));
  },

  removeReviewerBot: async (sessionId, agentId) => {
    await updateSessionMetadata(sessionId, (session) => {
      if (!session.reviewers.some((reviewer) => reviewer.agentId === agentId)) return null;
      return {
        status: session.status === 'closed' ? 'closed' : 'open',
        reviewers: session.reviewers
          .filter((reviewer) => reviewer.agentId !== agentId)
          .map((reviewer) => ({ ...reviewer, reviewStatus: 'pending' as const })),
      };
    });
    void import('../../review/services/assignedReviewService')
      .then(({ reReviewAssignedSession }) => reReviewAssignedSession(sessionId));
  },

  toggleSessionLabel: async (sessionId, labelId) => {
    const { repoLabels } = get();
    const targetLabel = repoLabels.find((l) => l.id === labelId);
    if (!targetLabel) return;

    await updateSessionMetadata(sessionId, (session) => {
      if (session.repoId !== targetLabel.repoId) return null;
      const has = session.labels.some((label) => label.id === labelId);
      return { labels: has
        ? session.labels.filter((label) => label.id !== labelId)
        : [...session.labels, targetLabel] };
    });
  },

  // Labels CRUD
  createRepoLabel: async (name, color, description) => {
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

  updateRepoLabel: async (label) => {
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

  deleteRepoLabel: async (labelId) => {
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
  saveRepoSettings: async (updates) => {
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

  addRemote: async (name, url) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('add_git_remote', { repoPath: currentRepoPath, name, url });
    await get().fetchRemotesDetailed();
  },

  removeRemote: async (name) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('remove_git_remote', { repoPath: currentRepoPath, name });
    await get().fetchRemotesDetailed();
  },

  setRemoteUrl: async (name, url) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('set_git_remote_url', { repoPath: currentRepoPath, name, url });
    await get().fetchRemotesDetailed();
  },

  testRemote: async (remoteOrUrl) => {
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

  createTag: async (name, commitRef, message) => {
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

  deleteTag: async (name) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('delete_git_tag', { repoPath: currentRepoPath, tagName: name });
    await get().fetchTags();
  },

  createBranch: async (name, startPoint) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('create_git_branch', {
      repoPath: currentRepoPath,
      branchName: name,
      startPoint: startPoint || null,
    });
  },

  deleteBranch: async (name, force = false) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('delete_git_branch', { repoPath: currentRepoPath, branchName: name, force });
  },

  renameBranch: async (oldName, newName) => {
    const { currentRepoPath } = get();
    if (!currentRepoPath) return;
    await invoke('rename_git_branch', { repoPath: currentRepoPath, oldName, newName });
  },

  // Discussions
  createDiscussion: async (sessionId, payload) => {
    const { sessions } = get();
    const targetSession = sessions.find((s) => s.id === sessionId);
    if (!targetSession) return;

    const discId = `disc-${Date.now()}`;
    const commentId = `comm-${Date.now()}`;
    const now = new Date().toISOString();

    const newComment: VirtualMrComment = {
      id: commentId,
      discussionId: discId,
      authorType: 'user',
      authorId: targetSession.assignee.email,
      authorName: targetSession.assignee.name,
      body: payload.initialComment,
      reviewAction: payload.reviewAction,
      createdAt: now,
      updatedAt: now,
    };

    const newDisc: VirtualMrDiscussion = {
      id: discId,
      sessionId,
      filePath: payload.filePath || null,
      diffSide: payload.diffSide || null,
      lineNumber: payload.lineNumber || null,
      isResolved: false,
      resolveType: 'manual',
      comments: [newComment],
      createdAt: now,
    };

    set({
      sessions: sessions.map((s) => (s.id === sessionId ? { ...s, discussions: [...s.discussions, newDisc] } : s)),
    });

    let saved = false;
    try {
      await invoke('create_mr_discussion', {
        discussion: {
          id: newDisc.id,
          session_id: sessionId,
          file_path: newDisc.filePath,
          diff_side: newDisc.diffSide,
          line_number: newDisc.lineNumber,
          commit_id: null,
          is_resolved: false,
          resolve_type: 'manual',
          resolved_by: null,
          resolved_at: null,
          verification_status: 'none',
          verified_by_bot: null,
          verified_at: null,
          created_at: now,
          comments: [],
        },
        firstComment: {
          id: newComment.id,
          discussion_id: discId,
          author_type: newComment.authorType,
          author_id: newComment.authorId,
          author_name: newComment.authorName,
          author_avatar: null,
          body: newComment.body,
          review_action: newComment.reviewAction || null,
          created_at: now,
          updated_at: now,
        },
      });
      saved = true;
    } catch (e) {
      console.error('Failed to create discussion in db:', e);
    }
    if (saved) {
      await get().invalidateReviewerApprovals(sessionId);
      void import('../../review/services/assignedReviewService')
        .then(({ reReviewAssignedSession }) => reReviewAssignedSession(sessionId));
    }
  },

  replyToDiscussion: async (discussionId, body, reviewAction, authorType = 'user', authorName) => {
    const { sessions } = get();
    const commentId = `comm-${Date.now()}`;
    const now = new Date().toISOString();

    const updated = sessions.map((s) => ({
      ...s,
      discussions: s.discussions.map((d) => {
        if (d.id !== discussionId) return d;
        const newComm: VirtualMrComment = {
          id: commentId,
          discussionId,
          authorType,
          authorId: authorType === 'ai_agent' ? 'ai-bot' : s.assignee.email,
          authorName: authorName || (authorType === 'ai_agent' ? 'Security Bot' : s.assignee.name),
          body,
          reviewAction,
          createdAt: now,
          updatedAt: now,
        };
        return { ...d, comments: [...d.comments, newComm] };
      }),
    }));

    set({ sessions: updated });

    const targetSessionId = sessions.find((session) => session.discussions.some((discussion) => discussion.id === discussionId))?.id;
    let saved = false;
    try {
      await invoke('add_mr_comment', {
        comment: {
          id: commentId,
          discussion_id: discussionId,
          author_type: authorType,
          author_id: authorType === 'ai_agent' ? 'ai-bot' : 'local-user',
          author_name: authorName || (authorType === 'ai_agent' ? 'Security Bot' : 'Local User'),
          author_avatar: null,
          body,
          review_action: reviewAction || null,
          created_at: now,
          updated_at: now,
        },
      });
      saved = true;
    } catch (e) {
      console.error('Failed to add comment in db:', e);
    }
    if (saved && authorType === 'user' && targetSessionId) {
      await get().invalidateReviewerApprovals(targetSessionId);
      void import('../../review/services/assignedReviewService')
        .then(({ reReviewAssignedSession }) => reReviewAssignedSession(targetSessionId));
    }
  },

  resolveDiscussion: async (discussionId, isResolved, resolveType = 'manual') => {
    if (resolveType === 'ai_verified') throw new Error(AI_REVIEW_UNAVAILABLE);
    const { sessions } = get();
    const now = new Date().toISOString();

    const updated = sessions.map((s) => ({
      ...s,
      discussions: s.discussions.map((d) => {
        if (d.id !== discussionId) return d;
        return {
          ...d,
          isResolved,
          resolveType,
          resolvedBy: isResolved ? s.assignee.name : null,
          resolvedAt: isResolved ? now : null,
        };
      }),
    }));

    set({ sessions: updated });

    try {
      await invoke('resolve_mr_discussion', {
        discussionId,
        isResolved,
        resolveType,
        resolvedBy: isResolved ? 'Local User' : null,
      });
    } catch (e) {
      console.error('Failed to resolve discussion in db:', e);
    }
    const targetSessionId = sessions.find((session) => session.discussions.some((discussion) => discussion.id === discussionId))?.id;
    if (targetSessionId && !isResolved) await get().invalidateReviewerApprovals(targetSessionId);
    if (targetSessionId && isResolved) await get().tryResolveSession(targetSessionId);
  },

  // Re-review the committed Virtual MR snapshot; the model may resolve only
  // with exact changed-line evidence validated by the backend.
  reverifyDiscussionFix: async (discussionId) => {
    const session = get().sessions.find((item) => item.discussions.some((discussion) => discussion.id === discussionId));
    if (!session) return false;
    const { startAssignedReviewForSession } = await import('../../review/services/assignedReviewService');
    try { return Boolean(await startAssignedReviewForSession(session.id)); }
    catch { return false; }
  },
  triggerIncrementalReReview: async (sessionId) => {
    const { reReviewAssignedSession } = await import('../../review/services/assignedReviewService');
    await reReviewAssignedSession(sessionId);
  },
  refreshDiscussions: async (sessionId) => {
    const repoId = get().currentRepoId;
    const items = await invoke<DbDiscussion[]>('list_mr_discussions', { sessionId });
    if (get().currentRepoId !== repoId) return;
    set((state) => ({ sessions: state.sessions.map((session) => session.id === sessionId
      ? { ...session, discussions: items.map(fromDbDiscussion) } : session) }));
  },
}));
