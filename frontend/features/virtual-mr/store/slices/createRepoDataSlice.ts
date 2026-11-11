import { getRepositorySettingsSnapshot, loadRepositorySettings } from '../../services/repositorySettingsDocuments';
import { repoSettingsFromDocument } from '../../utils/repoSettingsFromDocument';
import { getApplicationServices } from '../../../../core/services/runtime/applicationRuntime';

import type { StateCreator } from 'zustand';
import { flushSessionWrites } from '../../services/sessionPersistence';
import { type RepoLabel } from '../../types/RepoLabel';
import { type VirtualMrCommit } from '../../types/VirtualMrCommit';
import { type VirtualMrDiscussion } from '../../types/VirtualMrDiscussion';
import { type VirtualMrSession } from '../../types/VirtualMrSession';
import type { VirtualMrState } from '../../types/VirtualMrState';
import { type VirtualMrStatus } from '../../types/VirtualMrStatus';
import { fromDbDiscussion } from '../../utils/fromDbDiscussion';
import { loadSessionTitleHistory } from '../../utils/virtualMrTitleHistory';
import { loadLocalGitAuthor } from '../../services/loadLocalGitAuthor';
import { resolveLocalAuthor } from '../../utils/localAuthorIdentity';

let repoDataRequestVersion = 0;
let repoMetadataRequestVersion = 0;
let completedRepoKey: string | null = null;
export const createRepoDataSlice: StateCreator<
  VirtualMrState,
  [],
  [],
  Pick<
    VirtualMrState,
    | 'currentRepoId'
    | 'currentRepoPath'
    | 'repoSettings'
    | 'repoLabels'
    | 'remotesDetailed'
    | 'tags'
    | 'loadRepoData'
    | 'refreshRepoMetadata'
    | 'resetRepoData'
  >
> = (set, get) => ({
  currentRepoId: null,

  currentRepoPath: null,

  repoSettings: null,

  repoLabels: [],

  remotesDetailed: [],

  tags: [],

  loadRepoData: async (
    repoId: string,
    repoPath: string,
    _availableBranches: string[],
    _defaultBase?: string
  ) => {
    const requestVersion = ++repoDataRequestVersion;
    const repoKey = `${repoId}:${repoPath}`;
    const repoChanged = completedRepoKey !== repoKey;
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
      // Never replace an invalid document with silently synthesized defaults.
      const doc = await loadRepositorySettings(repoId);
      const labels: RepoLabel[] = doc.labels.map((label) => ({
        id: label.id, repoId: label.repo_id, name: label.name,
        color: label.color, description: label.description || undefined,
      }));

      // 3. Load User Identity
      const localAuthor = await loadLocalGitAuthor(repoPath);

      // 4. Load Sessions (Parallelized to eliminate waterfall)
      let sessions: VirtualMrSession[] = [];
      try {
        await flushSessionWrites();
        const dbSessions = await getApplicationServices().virtualMrs.listVirtualMrSessions({ repoId });
        if (dbSessions && dbSessions.length > 0) {
          sessions = await Promise.all(
            dbSessions.map(async (ds) => {
              const [discRes, commitRes, activityRes] = await Promise.allSettled([
                getApplicationServices().discussions.listMrDiscussions({ sessionId: ds.id }),
                getApplicationServices().gitHistory.getCommitsBetweenRefs({
                  repoPath,
                  base: ds.base_branch,
                  compare: ds.compare_branch,
                }),
                getApplicationServices().discussions.listMrDeletionActivity({ sessionId: ds.id }),
              ]);

              let discussions: VirtualMrDiscussion[] = [];
              if (discRes.status === 'fulfilled' && discRes.value) {
                discussions = discRes.value.map((item) => fromDbDiscussion(item, localAuthor));
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
                status:
                  (ds.status === 'approved' ? 'open' : (ds.status as VirtualMrStatus)) || 'open',
                assignee: resolveLocalAuthor(ds.assignee_name, ds.assignee_email, localAuthor),
                reviewers: (ds.reviewers || []).map((reviewer: any) => ({
                  agentId: reviewer.agent_id,
                  agentName: reviewer.agent_name,
                  reviewStatus:
                    reviewer.review_status || 'pending',
                  assignedAt: reviewer.assigned_at,
                })),
                labels: attachedLabels,
                discussions,
                deletionActivity: activityRes.status === 'fulfilled' ? activityRes.value : [],
                commits,
                isPinned: Boolean(ds.is_pinned),
                createdAt: ds.created_at,
                updatedAt: ds.updated_at,
                titleHistory: loadSessionTitleHistory(ds.id),
              };
            })
          );
        }
      } catch (err) {
        console.warn('Failed to load sessions from db:', err);
      }

      if (requestVersion !== repoDataRequestVersion) return;
      let closedSessionTabIds = get().closedSessionTabIds;
      let activeSessionId = get().activeSessionId;

      if (repoChanged) {
        // When opening a repo, do not auto-open any last MR;
        // keep activeSessionId null so the MR list view is displayed,
        // and close tabs initially so the user can open what they want.
        closedSessionTabIds = sessions.map((s) => s.id);
        completedRepoKey = repoKey;
        activeSessionId = null;
      } else {
        const sessionIds = new Set(sessions.map((s) => s.id));
        const previouslyOpen = new Set(
          get()
            .sessions.filter((s) => !get().closedSessionTabIds.includes(s.id))
            .map((s) => s.id)
        );
        closedSessionTabIds = sessions
          .filter((s) => !previouslyOpen.has(s.id))
          .map((s) => s.id);
        if (activeSessionId && !sessionIds.has(activeSessionId)) {
          activeSessionId = null;
        }
      }

      const latest = getRepositorySettingsSnapshot(repoId) ?? doc;
      const latestLabels = latest.labels.map((label) => ({ id: label.id, repoId,
        name: label.name, color: label.color, description: label.description || undefined }));
      set({
        repoSettings: repoSettingsFromDocument(repoId, latest),
        repoLabels: latestLabels,
        sessions: sessions.map((session) => ({ ...session,
          labels: session.labels.flatMap((label) => latestLabels.find((item) => item.id === label.id) ?? []),
        })),
        activeSessionId,
        closedSessionTabIds,
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
    try {
      const doc = await loadRepositorySettings(repoId);
      if (requestVersion !== repoMetadataRequestVersion || get().currentRepoId !== repoId) return;
      set({ repoSettings: repoSettingsFromDocument(repoId, doc), repoLabels: doc.labels.map((label) => ({
        id: label.id, repoId: label.repo_id, name: label.name, color: label.color,
        description: label.description || undefined,
      })) });
      if (doc.validationError) throw new Error(doc.validationError);
    } catch (error) {
      // Keep the last committed runtime snapshot and surface the failure.
      console.warn('Failed to refresh repository settings:', error);
      const prior = get().repoSettings;
      if (get().currentRepoId === repoId && prior) set({ repoSettings: { ...prior, validationError: String(error) } });
      throw error;
    }
  },

  resetRepoData: () => {
    completedRepoKey = null;
    set({
      currentRepoId: null,
      currentRepoPath: null,
      repoSettings: null,
      repoLabels: [],
      sessions: [],
      activeSessionId: null,
      pendingDescriptionEditSessionId: null,
      closedSessionTabIds: [],
      isMrListOpen: false,
      draftMr: null,
      isDraftActive: false,
      remotesDetailed: [],
      tags: [],
      isLoadingSessions: false,
    });
  },
});
