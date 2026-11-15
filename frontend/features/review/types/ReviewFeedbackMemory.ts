/** Repository-local review preference with its human-authored provenance. */
export interface ReviewFeedbackMemory {
  id: string;
  /** Empty for a repository-scoped conversational preference. */
  filePath: string;
  finding: string;
  feedback: string;
  reason: string;
  discussionId: string;
  commentId: string;
  updatedAt: string;
}
