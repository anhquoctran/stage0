import type { ReviewerState } from './ReviewerState';
import type { VirtualMrStatus } from './VirtualMrStatus';

export interface MrSyncState {
  sessionId: string;
  repoId: string;
  baseBranch: string;
  compareBranch: string;
  baseSha: string | null;
  headSha: string | null;
  revision: number;
  needsReview: boolean;
  refStatus: 'ready' | 'unavailable';
  sessionStatus: VirtualMrStatus;
  reviewers: Record<string, ReviewerState>;
}
