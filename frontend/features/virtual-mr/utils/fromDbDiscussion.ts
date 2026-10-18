import type { DbDiscussion } from '../types/DbDiscussion';
import type { VirtualMrDiscussion } from '../types/VirtualMrDiscussion';

export function fromDbDiscussion(item: DbDiscussion): VirtualMrDiscussion {
  return {
    id: item.id, sessionId: item.session_id, filePath: item.file_path, diffSide: item.diff_side,
    lineNumber: item.line_number, commitId: item.commit_id, contentHash: item.content_hash,
    contextBefore: item.context_before, contextAfter: item.context_after, isResolved: Boolean(item.is_resolved),
    resolveType: item.resolve_type, resolvedBy: item.resolved_by, resolvedAt: item.resolved_at,
    verificationStatus: item.verification_status, verifiedByBot: item.verified_by_bot,
    verifiedAt: item.verified_at, createdAt: item.created_at,
    comments: (item.comments || []).map((comment) => ({
      id: comment.id, discussionId: comment.discussion_id, authorType: comment.author_type,
      authorId: comment.author_id, authorName: comment.author_name, authorAvatar: comment.author_avatar || undefined,
      body: comment.body, reviewAction: comment.review_action || undefined, createdAt: comment.created_at, updatedAt: comment.updated_at,
    })),
  };
}
