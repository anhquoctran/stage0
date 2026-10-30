import type { VirtualMrSession } from '../types/VirtualMrSession';
import i18n from '../../i18n/i18n';
import { isResolvableDiscussion } from './discussionReferences';

export function getManualReviewBlockReason(
  session: Pick<VirtualMrSession, 'discussions'> | null | undefined,
): string | null {
  const count = (session?.discussions || []).filter(
    (discussion) => !discussion.isResolved && isResolvableDiscussion(discussion),
  ).length;
  return count > 0 ? i18n.t('virtualMr.toasts.resolveOpenDiscussions', { count }) : null;
}
