import type { VirtualMrComment } from '../../types/VirtualMrComment';
import type { VirtualMrDiscussion } from '../../types/VirtualMrDiscussion';

export interface DiscussionThreadHeaderProps {
  rootAuthorName: string;
  rootComment: VirtualMrComment;
  rootAuthorHandle: string;
  discussion: VirtualMrDiscussion;
  threadRelativeTime: string;
  quote: (comment?: VirtualMrComment) => void;
  isSubmitting: boolean;
}
