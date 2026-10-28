import { formatRelativeTime } from '../../../common/utils/dateTime';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import type { AuthorType } from '../types/AuthorType';

/**
 * Derives a GitLab style handle (@handle) from full name or authorId.
 */
export function getAuthorHandle(name: string, authorId?: string, authorType: AuthorType = 'user'): string {
  const normalize = (value: string) => value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/\u0110/g, 'D')
    .trim().toLowerCase();
  if (authorType === 'ai_agent') {
    const reviewerName = /^Stage0 AI \((.*)\)$/.exec(name.trim())?.[1] ?? name;
    const slug = normalize(reviewerName).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `@${slug || 'reviewer'}`;
  }
  if (authorId && authorId.includes('@')) {
    const localPart = authorId.split('@')[0].trim().toLowerCase();
    if (localPart) return `@${localPart}`;
  }

  if (name && name.includes('@')) {
    const localPart = name.split('@')[0].trim().toLowerCase();
    if (localPart) return `@${localPart}`;
  }

  const normalized = normalize(name).replace(/[^a-z0-9\s._-]/g, '');

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const lastName = words[words.length - 1];
    const otherInitials = words
      .slice(0, -1)
      .map((w) => w[0])
      .join('');
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
    badges.push('Maintainer');
  }
  return badges;
}

/**
 * Formats time in GitLab style: "1 day ago", "2 hours ago", "just now".
 * Automatically normalizes SQLite UTC timestamps ("YYYY-MM-DD HH:MM:SS") to ISO UTC ("...Z")
 * to avoid local timezone offset miscalculations.
 */
export function formatGitLabTime(dateInput: string): string {
  return dateInput ? formatRelativeTime(dateInput) : '';
}
