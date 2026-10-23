import { useGitStore } from '../../git/store/useGitStore';
import { startAssignedReviewBatchForSession } from '../../review/services/assignedReviewService';

// MR creation remains complete while the assigned review runs in the background.
export function startNewMrReviewBatch(sessionId: string) {
  void startAssignedReviewBatchForSession(sessionId)
    .then((result) => {
      if (result.failures.length) {
        useGitStore
          .getState()
          .showToast(
            `Virtual MR created. AI review failed or incomplete: ${[result.failures[0], !result.descriptionGenerated ? 'The MR description was not updated.' : 'The MR description was saved.'].join(' ')}`,
            'warning'
          );
      } else if (!result.descriptionGenerated) {
        useGitStore
          .getState()
          .showToast(
            result.hasChanges
              ? 'Virtual MR created, but no reviewer could generate its description from the available diff.'
              : 'Virtual MR created, but no changed files were found in its review snapshot.',
            result.hasChanges ? 'warning' : 'info'
          );
      } else {
        const partial = result.runs.some((run) => run.status === 'partial');
        useGitStore
          .getState()
          .showToast(
            `AI review ${partial ? 'finished with incomplete coverage' : 'completed'} for ${result.runs.length} assigned reviewers. The MR description was updated.`,
            partial ? 'warning' : 'success'
          );
      }
    })
    .catch((error) => {
      useGitStore
        .getState()
        .showToast(
          `Virtual MR created, but AI review could not start: ${error instanceof Error ? error.message : String(error)}`,
          'error'
        );
    });
}
