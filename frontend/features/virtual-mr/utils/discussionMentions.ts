import type { MentionOption } from '../../../common/types/MentionOption';
import type { VirtualMrSession } from '../types/VirtualMrSession';

export function getDiscussionMentionOptions(session: VirtualMrSession, authorType: 'user' | 'ai_agent' = 'user', authorId = session.assignee.email): MentionOption[] {
  const reviewers = session.reviewers.map((reviewer) => ({
    id: reviewer.agentId, label: reviewer.agentName, kind: 'reviewer' as const,
  }));
  const options: MentionOption[] = authorType === 'ai_agent'
    ? [{ id: session.assignee.email, label: session.assignee.name, kind: 'assignee' }, ...reviewers.filter((item) => item.id !== authorId)]
    : reviewers;
  return options.filter((item, index) => item.id && options.findIndex((other) => other.kind === item.kind && other.id === item.id) === index);
}
