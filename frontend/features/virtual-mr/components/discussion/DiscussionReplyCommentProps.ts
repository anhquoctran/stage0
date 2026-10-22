import type { VirtualMrComment } from '../../types/VirtualMrComment';

export interface DiscussionReplyCommentProps {
  reply: VirtualMrComment;
  handle: string;
  relativeTime: string;
  badges: string[];
  quote: (comment?: VirtualMrComment) => void;
  isSubmitting: boolean;
}
