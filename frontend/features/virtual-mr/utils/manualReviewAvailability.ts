import type { VirtualMrSession } from '../types/VirtualMrSession';
import { isResolvableDiscussion } from './discussionReferences';

export function getManualReviewBlockReason(
  session: Pick<VirtualMrSession, 'discussions'> | null | undefined,
): string | null {
  const count = (session?.discussions || []).filter(
    (discussion) => !discussion.isResolved && isResolvableDiscussion(discussion),
  ).length;
  return count > 0
    ? `Resolve ${count} open code discussion${count === 1 ? '' : 's'} before starting another AI review.`
    : null;
}
