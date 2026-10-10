import type { AiReviewerBotMeta } from './AiReviewerBotMeta';
import type { RepoLabel } from './RepoLabel';

export const AVAILABLE_AI_BOTS: AiReviewerBotMeta[] = [];

export const PRESET_REPO_LABELS: Omit<RepoLabel, 'id' | 'repoId'>[] = [
  { name: 'feature', color: '#3b82f6', description: 'New feature or enhancement' },
  { name: 'bugfix', color: '#ef4444', description: 'Bug fix or error resolution' },
  { name: 'refactor', color: '#8b5cf6', description: 'Code refactoring without behavioral changes' },
  { name: 'security', color: '#f59e0b', description: 'Security patch or vulnerability fix' },
  { name: 'performance', color: '#10b981', description: 'Performance and memory optimization' },
  { name: 'documentation', color: '#06b6d4', description: 'Documentation additions or improvements' },
  { name: 'needs-review', color: '#ec4899', description: 'Awaiting reviewer feedback' },
  { name: 'ai-approved', color: '#22c55e', description: 'Approved by AI Reviewer bots' },
  { name: 'changes-requested', color: '#f97316', description: 'Changes requested before merge' },
];

export type { VirtualMrStatus } from './VirtualMrStatus';
export type { ReviewActionType } from './ReviewActionType';
export type { ReviewerState } from './ReviewerState';
export type { AuthorType } from './AuthorType';
export type { ResolveType } from './ResolveType';
export type { VerificationStatus } from './VerificationStatus';
export type { RepoLabel } from './RepoLabel';
export type { VirtualMrComment } from './VirtualMrComment';
export type { VirtualMrDiscussion } from './VirtualMrDiscussion';
export type { VirtualMrReviewer } from './VirtualMrReviewer';
export type { VirtualMrCommit } from './VirtualMrCommit';
export type { VirtualMrSession } from './VirtualMrSession';
export type { NewMrDraft } from './NewMrDraft';
export type { BotCategory } from './BotCategory';
export type { BotReviewer } from './BotReviewer';
export type { RepoSettings } from './RepoSettings';
export type { GitRemoteDetail } from './GitRemoteDetail';
export type { GitTagInfo } from './GitTagInfo';
export type { AiReviewerBotMeta } from './AiReviewerBotMeta';
