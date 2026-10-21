import type { VirtualMrSession } from '../types/VirtualMrSession';

export interface VirtualMrActivityOptions {
  isReviewOngoing?: boolean;
}

/**
 * Checks whether a Virtual MR has had any discussion or review activity,
 * or currently has an active review in progress.
 *
 * Branch changes are only permitted when NO discussion or review activity has occurred.
 */
export function hasVirtualMrActivity(
  session: VirtualMrSession | null | undefined,
  options?: VirtualMrActivityOptions
): boolean {
  if (!session) return false;

  // 1. Any discussion thread exists (general or inline diff discussions)
  if (Array.isArray(session.discussions) && session.discussions.length > 0) {
    return true;
  }

  // 2. Any reviewer has acted, commented, approved, requested changes, or is currently reviewing
  if (
    Array.isArray(session.reviewers) &&
    session.reviewers.some((reviewer) => reviewer.reviewStatus && reviewer.reviewStatus !== 'pending')
  ) {
    return true;
  }

  // 3. Ongoing review activity (in-flight batch, starting review, or running review)
  if (options?.isReviewOngoing) {
    return true;
  }

  return false;
}

