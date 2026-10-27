import type { DiscussionReference } from '../types/DiscussionReference';
import type { VirtualMrComment } from '../types/VirtualMrComment';
import type { VirtualMrDiscussion } from '../types/VirtualMrDiscussion';
import { getDiscussionCommentBody } from './discussionCommentBody';

export function getDiscussionComments(discussion: VirtualMrDiscussion): VirtualMrComment[] {
  return discussion.rootComment ? [discussion.rootComment, ...discussion.children] : discussion.children;
}

export function parseDiscussionReference(href: string): DiscussionReference | null {
  const match = /^#mr-(discussion|comment)\/(.+)$/.exec(href);
  if (!match) return null;
  try {
    return { kind: match[1] as DiscussionReference['kind'], id: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

export function buildDiscussionQuote(discussion: VirtualMrDiscussion, comment?: VirtualMrComment): string {
  const source = comment ?? discussion.rootComment;
  const kind = comment ? 'comment' : 'discussion';
  const id = comment?.id ?? discussion.id;
  const author = (source?.authorName ?? 'Unknown author').replace(/[\\`*_{}\[\]<>!|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
  const label = `${kind === 'comment' ? 'Comment' : 'Discussion'} ${id.replace(/[\\`*_{}\[\]<>!|]/g, '\\$&')} · ${author}`;
  const body = (source ? getDiscussionCommentBody(source) : '').replace(/\r\n?/g, '\n').split('\n').map((line) => `> ${line}`).join('\n');
  return `> [${label}](#mr-${kind}/${encodeURIComponent(id)})\n>\n${body}\n\n`;
}

/**
 * Determines whether a discussion thread represents a code review discussion on a specific code line/diff
 * that can be resolved.
 *
 * General discussions (MR-level discussion threads not interacting with any code line)
 * are informational conversations and do not have resolve capabilities or block MR resolution.
 */
export function isResolvableDiscussion(
  discussion?: Pick<VirtualMrDiscussion, 'filePath' | 'lineNumber'> | null
): boolean {
  if (!discussion) return false;
  return Boolean(discussion.filePath && discussion.filePath.trim().length > 0);
}
