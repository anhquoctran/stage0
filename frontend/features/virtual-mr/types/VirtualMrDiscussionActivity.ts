export interface VirtualMrDiscussionActivity {
  id: string;
  sessionId: string;
  discussionId: string;
  action: 'resolved' | 'reopened';
  actorId: string;
  actorName: string;
  reviewerName: string;
  filePath: string | null;
  createdAt: string;
}
