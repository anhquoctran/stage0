import type { ParticipantRole } from '../types/ParticipantRole';
import type { VirtualMrParticipant } from '../types/VirtualMrParticipant';
import type { VirtualMrSession } from '../types/VirtualMrSession';

/**
 * Returns a deduplicated list of participants for a Virtual MR:
 * - Creator & Assignee (session.assignee)
 * - Reviewers (session.reviewers)
 * - Commit authors (session.commits)
 * - Commenters (session.discussions)
 */
export function getVirtualMrParticipants(
  session?: VirtualMrSession | null
): VirtualMrParticipant[] {
  if (!session) return [];

  const participants: VirtualMrParticipant[] = [];

  const findExisting = (
    name: string,
    email?: string,
    isAiAgent = false,
    agentId?: string
  ): VirtualMrParticipant | undefined => {
    const normName = name?.trim().toLowerCase();
    const normEmail = email?.trim().toLowerCase();
    const normAgentId = agentId?.trim().toLowerCase();

    for (const p of participants) {
      if (isAiAgent && p.isAiAgent) {
        if (normAgentId && p.id === `reviewer-${normAgentId}`) return p;
        if (normName && p.name.trim().toLowerCase() === normName) return p;
      }
      if (!isAiAgent && !p.isAiAgent) {
        if (normEmail && p.email && p.email.trim().toLowerCase() === normEmail) return p;
        if (normName && p.name.trim().toLowerCase() === normName) return p;
      }
    }
    return undefined;
  };

  const addOrMerge = (
    initial: Omit<VirtualMrParticipant, 'roles'> & {
      role: ParticipantRole;
      agentId?: string;
    }
  ) => {
    const existing = findExisting(
      initial.name,
      initial.email,
      initial.isAiAgent,
      initial.agentId
    );

    if (existing) {
      if (!existing.roles.includes(initial.role)) {
        existing.roles.push(initial.role);
      }
      if (!existing.avatarUrl && initial.avatarUrl) {
        existing.avatarUrl = initial.avatarUrl;
      }
      if (!existing.email && initial.email) {
        existing.email = initial.email;
      }
    } else {
      participants.push({
        id: initial.id,
        name: initial.name,
        email: initial.email,
        avatarUrl: initial.avatarUrl,
        isAiAgent: initial.isAiAgent,
        roles: [initial.role],
      });
    }
  };

  // 1. Assignee / Creator
  if (session.assignee?.name) {
    addOrMerge({
      id: `assignee-${session.assignee.email || session.assignee.name}`,
      name: session.assignee.name,
      email: session.assignee.email,
      avatarUrl: session.assignee.avatarUrl,
      isAiAgent: false,
      role: 'Assignee',
    });
    // Ensure Creator is also present for the MR creator/assignee
    const assigneeEntry = participants[0];
    if (assigneeEntry && !assigneeEntry.roles.includes('Creator')) {
      assigneeEntry.roles.unshift('Creator');
    }
  }

  // 2. Reviewers
  if (Array.isArray(session.reviewers)) {
    for (const rev of session.reviewers) {
      if (!rev.agentName && !rev.agentId) continue;
      addOrMerge({
        id: `reviewer-${rev.agentId}`,
        name: rev.agentName,
        isAiAgent: true,
        agentId: rev.agentId,
        role: 'Reviewer',
      });
    }
  }

  // 3. Commit Authors
  if (Array.isArray(session.commits)) {
    for (const commit of session.commits) {
      if (!commit.authorName && !commit.authorEmail) continue;
      addOrMerge({
        id: `author-${commit.authorEmail || commit.authorName}`,
        name: commit.authorName,
        email: commit.authorEmail,
        isAiAgent: false,
        role: 'Author',
      });
    }
  }

  // 4. Discussion Commenters
  if (Array.isArray(session.discussions)) {
    for (const disc of session.discussions) {
      const comments = [disc.rootComment, ...(disc.children || [])].filter(Boolean);
      for (const comment of comments) {
        if (!comment || (!comment.authorName && !comment.authorId)) continue;
        const isBot = comment.authorType === 'ai_agent';
        addOrMerge({
          id: `commenter-${comment.authorId || comment.authorName}`,
          name: comment.authorName,
          avatarUrl: comment.authorAvatar,
          isAiAgent: isBot,
          agentId: isBot ? comment.authorId : undefined,
          role: 'Commenter',
        });
      }
    }
  }

  return participants;
}

