import { useGitStore } from '../../git/store/useGitStore';
import i18n from '../../i18n/i18n';
import { startAssignedReviewBatchForSession } from '../../review/services/assignedReviewService';

// MR creation remains complete while the assigned review runs in the background.
export function startNewMrReviewBatch(sessionId: string) {
  void startAssignedReviewBatchForSession(sessionId)
    .then((result) => {
      if (result.failures.length) {
        useGitStore
          .getState()
          .showToast(
            i18n.t('virtualMr.toasts.createdReviewFailed', {
              detail: `${result.failures[0]} ${i18n.t(result.descriptionGenerated ? 'virtualMr.toasts.descriptionSaved' : 'virtualMr.toasts.descriptionNotUpdated')}`,
            }),
            'warning'
          );
      } else if (!result.descriptionGenerated) {
        useGitStore
          .getState()
          .showToast(
            result.hasChanges
              ? i18n.t('virtualMr.toasts.createdDescriptionFailed')
              : i18n.t('virtualMr.toasts.createdNoChangedFiles'),
            result.hasChanges ? 'warning' : 'info'
          );
      } else {
        const partial = result.runs.some((run) => run.status === 'partial');
        useGitStore
          .getState()
          .showToast(
            i18n.t('virtualMr.toasts.createdReviewCompleted', {
              status: i18n.t(partial ? 'virtualMr.toasts.partial' : 'virtualMr.toasts.completed'),
              count: result.runs.length,
            }),
            partial ? 'warning' : 'success'
          );
      }
    })
    .catch((error) => {
      useGitStore
        .getState()
        .showToast(
          i18n.t('virtualMr.toasts.createdReviewStartFailed', { error: error instanceof Error ? error.message : String(error) }),
          'error'
        );
    });
}
