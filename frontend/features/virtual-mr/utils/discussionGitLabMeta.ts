import type { VirtualMrSession } from '../types/VirtualMrSession';
import dayjs from 'dayjs';

/**
 * Derives a GitLab-style @handle from author name or email.
 * E.g., "Nguyễn Huỳnh Duy" -> "@duynh", "Tôn Quốc Nam" -> "@namtq"
 */
export function getAuthorHandle(authorName: string, authorId?: string): string {
  if (authorId && authorId.includes('@')) {
    const localPart = authorId.split('@')[0].trim().toLowerCase();
    if (localPart) return `@${localPart}`;
  }

  if (!authorName) return '@user';

  // Strip Vietnamese diacritics / accents
  const normalized = authorName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const lastName = words[words.length - 1];
    const otherInitials = words.slice(0, -1).map((w) => w[0]).join('');
    return `@${lastName}${otherInitials}`;
  }

  return `@${normalized.replace(/[^a-z0-9]/g, '') || 'user'}`;
}

/**
 * Returns role badges matching GitLab (Author, Maintainer, Developer, AI Reviewer).
 */
export function getAuthorBadges(
  authorName: string,
  authorType: 'user' | 'ai_agent',
  session?: VirtualMrSession
): string[] {
  const badges: string[] = [];

  if (authorType === 'ai_agent') {
    badges.push('AI Reviewer');
    return badges;
  }

  if (!session) {
    badges.push('Developer');
    return badges;
  }

  const isAuthor =
    authorName.toLowerCase() === session.assignee.name.toLowerCase() ||
    authorName.toLowerCase() === session.assignee.email.toLowerCase();

  if (isAuthor) {
    badges.push('Author');
    badges.push('Developer');
  } else {
    // Check if in reviewers
    const isReviewer = session.reviewers.some(
      (r) => r.agentName.toLowerCase() === authorName.toLowerCase()
    );
    if (isReviewer) {
      badges.push('Maintainer');
    } else {
      badges.push('Maintainer');
    }
  }

  return badges;
}

/**
 * Formats time in GitLab style: "1 day ago", "2 hours ago", "just now"
 */
export function formatGitLabTime(dateInput: string): string {
  if (!dateInput) return '';
  const date = dayjs(dateInput);
  if (!date.isValid()) return '';

  const seconds = Math.max(0, dayjs().diff(date, 'second'));
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(seconds / 3600);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;

  const days = Math.floor(seconds / 86400);
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;

  const months = Math.floor(seconds / (30 * 86400));
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;

  const years = Math.floor(seconds / (365 * 86400));
  return years === 1 ? '1 year ago' : `${years} years ago`;
}
