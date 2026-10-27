import type { VirtualMrComment } from '../types/VirtualMrComment';

/** Hide legacy metadata and duplicate evidence without changing stored findings. */
export function getDiscussionCommentBody(
  comment: Pick<VirtualMrComment, 'id' | 'discussionId' | 'authorType' | 'body'>,
): string {
  const { body, discussionId } = comment;
  if (comment.authorType !== 'ai_agent' || comment.id !== `${discussionId}-comment`) return body;
  const runId = /^review-([\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})-\d+$/i.exec(discussionId)?.[1];
  if (!runId) return body;
  const marker = `\n\nReview run \`${runId}\` · `;
  const start = body.lastIndexOf(marker);
  let displayBody = body;
  if (start >= 0) {
    const footer = body.slice(start + marker.length);
    if (!/^[^\r\n]+ · [^\r\n]+\. This is a model finding, not an approval\.\s*$/.test(footer)) return body;
    displayBody = body.slice(0, start);
  }
  const evidenceStart = displayBody.lastIndexOf('\n\nEvidence from `');
  if (evidenceStart < 0) return displayBody;
  const evidence = displayBody.slice(evidenceStart);
  if (!/^\n\nEvidence from `[\da-f]{40,64}` lines \d+–\d+:\n\n```\n[\s\S]*\n```\s*$/i.test(evidence)) return displayBody;
  return displayBody.slice(0, evidenceStart);
}
