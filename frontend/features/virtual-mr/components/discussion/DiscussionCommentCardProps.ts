import type { VirtualMrComment } from '../../types/VirtualMrComment';
import type { VirtualMrDiscussion } from '../../types/VirtualMrDiscussion';
import type { VirtualMrSession } from '../../types/VirtualMrSession';

export interface DiscussionCommentCardProps {
  rootComment: VirtualMrComment;
  session: VirtualMrSession;
  isResolvable: boolean;
  discussion: VirtualMrDiscussion;
  quote: (comment?: VirtualMrComment) => void;
  isSubmitting: boolean;
}
