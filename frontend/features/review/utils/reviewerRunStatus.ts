import type { ReviewRun } from '../types/ReviewRun';
import type { ReviewerState } from '../../virtual-mr/types/ReviewerState';

/** Terminal execution errors take precedence over any unfinished/staged verdict. */
export function reviewerRunStatus(run: ReviewRun): ReviewerState {
  switch (run.status) {
    case 'running': return 'reviewing';
    case 'failed':
    case 'incomplete':
    case 'interrupted':
    case 'cancelled': return run.status;
    default:
      if (run.decision === 'request_changes' || run.findings.length > 0) return 'changes_requested';
      return run.status === 'completed' && run.decision === 'approve' ? 'approved' : 'commented';
  }
}
