/** Persisted audit metadata; deleted bodies are never retained. */
export interface VirtualMrDeletionActivity {
  id: string;
  sessionId: string;
  discussionId: string;
  commentId: string;
  targetKind: 'discussion' | 'reply';
  actorId: string;
  actorName: string;
  createdAt: string;
}
