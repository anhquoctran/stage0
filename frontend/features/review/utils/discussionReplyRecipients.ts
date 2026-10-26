import type { VirtualMrDiscussion } from '../../virtual-mr/types/VirtualMrDiscussion';
import { getDiscussionComments } from '../../virtual-mr/utils/discussionReferences';

/** UI routing only; the backend independently checks identity and addressing. */
export function directReviewerMentions(body: string, ids: string[]): string[] {
  const found = new Set<string>();
  let fence: { marker: string; length: number } | null = null;
  let ticks = 0;
  for (const line of body.split('\n')) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('>') || line.startsWith('    ') || line.startsWith('\t')) continue;
    const marker = /^(`{3,}|~{3,})/.exec(trimmed)?.[1];
    if (marker) {
      if (!fence) fence = { marker: marker[0], length: marker.length };
      else if (marker[0] === fence.marker && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    for (let index = 0; index < trimmed.length; index++) {
      if (trimmed[index] === '\\') { index++; continue; }
      if (trimmed[index] === '`') {
        const count = /^`+/.exec(trimmed.slice(index))![0].length;
        if (!ticks) ticks = count; else if (ticks === count) ticks = 0;
        index += count - 1;
        continue;
      }
      if (!ticks && trimmed.startsWith('[@', index) && trimmed[index - 1] !== '!') {
        const end = trimmed.indexOf('](', index);
        if (end >= 0) for (const id of ids) {
          if (trimmed.startsWith(`](#mr-mention/reviewer/${encodeURIComponent(id)})`, end)) found.add(id);
        }
      }
    }
  }
  return [...found];
}

export function discussionReplyRecipients(discussion: VirtualMrDiscussion, ids: string[]): string[] {
  const comments = getDiscussionComments(discussion);
  const latest = comments.at(-1);
  if (!latest || discussion.isResolved) return [];
  const mentioned = directReviewerMentions(latest.body, ids);
  if (latest.authorType === 'user') {
    if (mentioned.length) return mentioned;
    const originalReviewer = comments[0]?.authorId;
    return [ids.find((id) => id === originalReviewer) || ids[0]].filter((id): id is string => Boolean(id));
  }
  if (latest.authorType === 'ai_agent') return mentioned.filter((id) => id !== latest.authorId);
  return [];
}
