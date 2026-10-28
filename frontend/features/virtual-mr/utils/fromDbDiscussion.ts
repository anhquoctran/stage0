import type { DbDiscussion } from '../types/DbDiscussion';
import type { VirtualMrDiscussion } from '../types/VirtualMrDiscussion';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import { resolveLocalAuthor } from './localAuthorIdentity';

/**
 * Normalizes SQLite UTC timestamps ("YYYY-MM-DD HH:MM:SS") to standard ISO-8601 with "Z".
 * Without "Z", JavaScript's Date constructor treats the timestamp as local time,
 * causing timezone offset errors (e.g. 7 hours difference for UTC+7).
 */
export function normalizeDbTimestamp(ts: string | null | undefined): string {
  if (!ts) return '';
  const trimmed = ts.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
    return `${trimmed.replace(' ', 'T')}Z`;
  }
  return trimmed;
}

export function fromDbDiscussion(item: DbDiscussion, localAuthor?: VirtualMrSession['assignee']): VirtualMrDiscussion {
  const [rootComment = null, ...children] = (item.comments || []).map((comment) => ({
    id: comment.id,
    discussionId: comment.discussion_id,
    authorType: comment.author_type,
    authorId: comment.author_type === 'user' && localAuthor
      ? resolveLocalAuthor(comment.author_name, comment.author_id, localAuthor).email : comment.author_id,
    authorName: comment.author_type === 'user' && localAuthor
      ? resolveLocalAuthor(comment.author_name, comment.author_id, localAuthor).name : comment.author_name,
    authorAvatar: comment.author_avatar || undefined,
    body: comment.body,
    reviewAction: comment.review_action || undefined,
    createdAt: normalizeDbTimestamp(comment.created_at),
    updatedAt: normalizeDbTimestamp(comment.updated_at),
  }));

  return {
    id: item.id,
    sessionId: item.session_id,
    filePath: item.file_path,
    diffSide: item.diff_side,
    lineNumber: item.line_number,
    commitId: item.commit_id,
    contentHash: item.content_hash,
    codeSnippet: item.code_snippet,
    contextBefore: item.context_before,
    contextAfter: item.context_after,
    isResolved: Boolean(item.is_resolved),
    resolveType: item.resolve_type,
    resolvedBy: item.resolved_by,
    resolvedAt: item.resolved_at ? normalizeDbTimestamp(item.resolved_at) : item.resolved_at,
    verificationStatus: item.verification_status,
    verifiedByBot: item.verified_by_bot,
    verifiedAt: item.verified_at ? normalizeDbTimestamp(item.verified_at) : item.verified_at,
    createdAt: normalizeDbTimestamp(item.created_at),
    rootComment,
    children,
  };
}
