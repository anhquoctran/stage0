import type { GitState } from '../../git/types/GitState';
import i18n from '../../i18n/i18n';
import { startAssignedReviewBatchForSession } from '../../review/services/assignedReviewService';
import type { VirtualMrSession } from '../types/VirtualMrSession';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import { getManualReviewBlockReason } from '../utils/manualReviewAvailability';

export function createStartMrReviewAction(
  session: VirtualMrSession,
  showToast: GitState['showToast']
) {
  return async () => {
    const current = useVirtualMrStore.getState().sessions.find((item) => item.id === session.id);
    if (!current) {
      showToast(i18n.t('virtualMr.toasts.sessionUnavailable'), 'warning');
      return;
    }
    const blockedReason = getManualReviewBlockReason(current);
    if (blockedReason) {
      showToast(blockedReason, 'warning');
      return;
    }
    try {
      const result = await startAssignedReviewBatchForSession(session.id);
      if (!result.runs.length && !result.failures.length) {
        showToast(i18n.t('virtualMr.toasts.noAssignedReviewers'), 'warning');
        return;
      }
      const completed = result.runs.filter(
        (run) => run.status === 'completed' || run.status === 'partial'
      ).length;
      const summary = i18n.t('virtualMr.toasts.reviewersFinished', {
        completed,
        total: session.reviewers.length,
      });
      if (result.failures.length) {
        showToast(
          i18n.t('virtualMr.toasts.reviewFailureSummary', {
            status: i18n.t(completed ? 'virtualMr.toasts.incomplete' : 'virtualMr.toasts.failed'),
            summary,
            detail: `${result.failures[0]} ${i18n.t(result.descriptionGenerated ? 'virtualMr.toasts.descriptionSaved' : 'virtualMr.toasts.descriptionNotUpdated')}`,
          }),
          completed ? 'warning' : 'error'
        );
      } else if (!result.descriptionGenerated) {
        showToast(
          result.hasChanges
            ? i18n.t('virtualMr.toasts.descriptionGenerationFailed', { summary })
            : i18n.t('virtualMr.toasts.noChangedFiles'),
          result.hasChanges ? 'warning' : 'info'
        );
      } else {
        const partial = result.runs.some((run) => run.status === 'partial');
        showToast(
          i18n.t('virtualMr.toasts.reviewSuccessSummary', {
            status: i18n.t(partial ? 'virtualMr.toasts.partial' : 'virtualMr.toasts.completed'),
            summary,
          }),
          partial ? 'warning' : 'success'
        );
      }
    } catch (error) {
      showToast(
        i18n.t('virtualMr.toasts.reviewStartFailed', { error: error instanceof Error ? error.message : String(error) }),
        'error'
      );
    }
  };
}
