import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { ReviewService } from './ReviewService';

export function createReviewService(transport: CommandTransport): ReviewService {
  return {
    cancelAiReview: (input) => transport.executeCommand('cancel_ai_review', input),
    getAiReview: (input) => transport.executeCommand('get_ai_review', input),
    listAiReviews: (input) => transport.executeCommand('list_ai_reviews', input),
    publishAiReview: (input) => transport.executeCommand('publish_ai_review', input),
    startAiReview: (input) => transport.executeCommand('start_ai_review', input),
  };
}
