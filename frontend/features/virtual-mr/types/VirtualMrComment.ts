import type { AuthorType } from './AuthorType';
import type { ReviewActionType } from './ReviewActionType';

export interface VirtualMrComment {
  id: string;
  discussionId: string;
  authorType: AuthorType;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  body: string; // Markdown format
  reviewAction?: ReviewActionType;
  createdAt: string;
  updatedAt: string;
  /** Frontend-only placeholder while a manual reviewer request is running. */
  isPending?: boolean;
  pendingLabel?: string;
}
