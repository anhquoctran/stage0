import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { ReviewService } from './ReviewService';

export function createReviewService(transport: CommandTransport): ReviewService {
  return {
    getReviewContextCache: (input) => transport.executeCommand('get_review_context_cache', input),
    clearReviewContextCache: (input) => transport.executeCommand('clear_review_context_cache', input),
    installReviewContextModel: (input) => transport.executeCommand('install_review_context_model', input),
    cancelAiReview: (input) => transport.executeCommand('cancel_ai_review', input),
    getAiReview: (input) => transport.executeCommand('get_ai_review', input),
    listAiReviews: (input) => transport.executeCommand('list_ai_reviews', input),
    publishAiReview: (input) => transport.executeCommand('publish_ai_review', input),
    startAiReview: (input) => transport.executeCommand('start_ai_review', input),
  };
}
