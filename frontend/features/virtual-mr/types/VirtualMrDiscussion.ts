import type { ResolveType } from './ResolveType';
import type { VerificationStatus } from './VerificationStatus';
import type { VirtualMrComment } from './VirtualMrComment';
import type { DiscussionCodeSnippet } from './DiscussionCodeSnippet';

export interface VirtualMrDiscussion {
  id: string;
  sessionId: string;
  filePath?: string | null;
  diffSide?: 'left' | 'right' | null;
  lineNumber?: number | null;
  commitId?: string | null;
  codeSnippet?: DiscussionCodeSnippet | null;
  contentHash?: string | null;
  contextBefore?: string | null;
  contextAfter?: string | null;
  isResolved: boolean;
  resolveType?: ResolveType;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  verificationStatus?: VerificationStatus | 'outdated';
  verifiedByBot?: string | null;
  verifiedAt?: string | null;
  rootComment: VirtualMrComment | null;
  children: VirtualMrComment[];
  createdAt: string;
}
