import type { GitState } from '../../git/types/GitState';
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
      showToast('This Virtual MR is no longer available.', 'warning');
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
        showToast('No assigned AI reviewer is available for this Virtual MR.', 'warning');
        return;
      }
      const completed = result.runs.filter(
        (run) => run.status === 'completed' || run.status === 'partial'
      ).length;
      const summary = `${completed}/${session.reviewers.length} reviewers finished.`;
      if (result.failures.length) {
        showToast(
          `AI review ${completed ? 'incomplete' : 'failed'}. ${summary} ${[result.failures[0], !result.descriptionGenerated ? 'The MR description was not updated.' : 'The MR description was saved.'].join(' ')}`,
          completed ? 'warning' : 'error'
        );
      } else if (!result.descriptionGenerated) {
        showToast(
          result.hasChanges
            ? `${summary} The MR description could not be generated from the available diff.`
            : 'No changed files were found in this Virtual MR snapshot.',
          result.hasChanges ? 'warning' : 'info'
        );
      } else {
        const partial = result.runs.some((run) => run.status === 'partial');
        showToast(
          `AI review ${partial ? 'finished with incomplete coverage' : 'completed'}. ${summary} The MR description was updated.`,
          partial ? 'warning' : 'success'
        );
      }
    } catch (error) {
      showToast(
        `AI code review could not start: ${error instanceof Error ? error.message : String(error)}`,
        'error'
      );
    }
  };
}
