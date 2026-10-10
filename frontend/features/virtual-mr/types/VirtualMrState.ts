import { type VirtualMrSession } from './VirtualMrSession';
import { type VirtualMrStatus } from './VirtualMrStatus';
import { type RepoLabel } from './RepoLabel';
import { type RepoSettings } from './RepoSettings';
import { type GitRemoteDetail } from './GitRemoteDetail';
import { type GitTagInfo } from './GitTagInfo';
import { type ReviewActionType } from './ReviewActionType';
import { type ResolveType } from './ResolveType';
import { type NewMrDraft } from './NewMrDraft';

export interface VirtualMrState {
  // Repository-scoped State
  currentRepoId: string | null;
  currentRepoPath: string | null;
  repoSettings: RepoSettings | null;
  repoLabels: RepoLabel[];
  remotesDetailed: GitRemoteDetail[];
  tags: GitTagInfo[];

  // Modal State
  isRepoSettingsOpen: boolean;
  repoSettingsActiveTab: 'remotes' | 'branches' | 'labels' | 'agents';
  openRepoSettings: (tab?: 'remotes' | 'branches' | 'labels' | 'agents') => void;
  closeRepoSettings: () => void;
  setRepoSettingsActiveTab: (tab: 'remotes' | 'branches' | 'labels' | 'agents') => void;

  // Virtual MR Sessions
  sessions: VirtualMrSession[];
  activeSessionId: string | null;
  isLoadingSessions: boolean;
  activeMrTab: 'overview' | 'commits' | 'diff';
  setActiveMrTab: (tab: 'overview' | 'commits' | 'diff') => void;

  // Draft Virtual MR Creation (GitHub / GitLab compare workflow)
  draftMr: NewMrDraft | null;
  isDraftActive: boolean;

  // Selectors
  getActiveSession: () => VirtualMrSession | null;

  // Actions
  loadRepoData: (repoId: string, repoPath: string, branches: string[], defaultBase?: string) => Promise<void>;
  createSession: (baseBranch?: string, compareBranch?: string, title?: string) => Promise<string>;
  openNewMrDraft: (baseBranch?: string, compareBranch?: string) => Promise<void>;
  updateDraftMr: (updates: Partial<NewMrDraft>) => void;
  changeDraftBranches: (base: string, compare: string) => Promise<void>;
  closeNewMrDraft: () => void;
  submitNewMrDraft: () => Promise<string>;
  activateDraftMr: () => void;
  switchSession: (sessionId: string) => void;
  closeSession: (sessionId: string) => Promise<void>;
  updateSessionStatus: (sessionId: string, status: VirtualMrStatus) => Promise<void>;
  updateSessionDetails: (sessionId: string, title: string, description: string) => Promise<void>;
  updateSessionBranches: (sessionId: string, base: string, compare: string) => Promise<void>;
  
  // Reviewer & Labels
  assignReviewerBot: (sessionId: string, botId: string) => Promise<void>;
  removeReviewerBot: (sessionId: string, agentId: string) => Promise<void>;
  toggleSessionLabel: (sessionId: string, labelId: string) => Promise<void>;

  // Labels CRUD
  createRepoLabel: (name: string, color: string, description?: string) => Promise<RepoLabel | void>;
  updateRepoLabel: (label: RepoLabel) => Promise<void>;
  deleteRepoLabel: (labelId: string) => Promise<void>;
  loadPresetLabels: () => Promise<void>;

  // Repo Settings Actions
  saveRepoSettings: (updates: Partial<RepoSettings>) => Promise<void>;
  fetchRemotesDetailed: () => Promise<void>;
  addRemote: (name: string, url: string) => Promise<void>;
  removeRemote: (name: string) => Promise<void>;
  setRemoteUrl: (name: string, url: string) => Promise<void>;
  testRemote: (remoteOrUrl: string) => Promise<string>;

  // Tags & Branches
  fetchTags: () => Promise<void>;
  createTag: (name: string, commitRef?: string, message?: string) => Promise<void>;
  deleteTag: (name: string) => Promise<void>;
  createBranch: (name: string, startPoint?: string) => Promise<void>;
  deleteBranch: (name: string, force?: boolean) => Promise<void>;
  renameBranch: (oldName: string, newName: string) => Promise<void>;

  // Discussions & Comments
  createDiscussion: (
    sessionId: string,
    payload: {
      filePath?: string;
      lineNumber?: number;
      diffSide?: 'left' | 'right';
      initialComment: string;
      reviewAction?: ReviewActionType;
    }
  ) => Promise<void>;
  replyToDiscussion: (
    discussionId: string,
    body: string,
    reviewAction?: ReviewActionType,
    authorType?: 'user' | 'ai_agent',
    authorName?: string
  ) => Promise<void>;
  resolveDiscussion: (discussionId: string, isResolved: boolean, resolveType?: ResolveType) => Promise<void>;
  reverifyDiscussionFix: (discussionId: string, agentId?: string) => Promise<boolean>;
  triggerIncrementalReReview: (sessionId: string) => Promise<void>;
}
