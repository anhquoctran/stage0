import type { VirtualMrStatus } from './VirtualMrStatus';
import type { VirtualMrReviewer } from './VirtualMrReviewer';
import type { RepoLabel } from './RepoLabel';
import type { VirtualMrDiscussion } from './VirtualMrDiscussion';
import type { VirtualMrCommit } from './VirtualMrCommit';

export interface VirtualMrSession {
  id: string;
  repoId: string;
  title: string;
  description: string; // Markdown description
  baseBranch: string;
  compareBranch: string;
  status: VirtualMrStatus;
  assignee: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  reviewers: VirtualMrReviewer[];
  labels: RepoLabel[];
  discussions: VirtualMrDiscussion[];
  commits: VirtualMrCommit[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}
