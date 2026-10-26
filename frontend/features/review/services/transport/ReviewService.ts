import type { AcpAgentConfig } from '../../../ai/types/AcpAgentConfig';
import type { AcpReviewConfigOverrides } from '../../../ai/types/AcpReviewConfigOverrides';
import type { AiProviderId } from '../../../ai/types/AiProviderId';
import type { AiReasoningEffort } from '../../../ai/types/AiReasoningEffort';
import type { BotCategory } from '../../../virtual-mr/types/BotCategory';
import type { ReviewRun } from '../../types/ReviewRun';
import type { ReviewRunDetail } from '../../types/ReviewRunDetail';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface ReviewService {
  cancelAiReview(input: {
    runId: string;
  }): Promise<unknown>;
  getAiReview(input: {
    runId: string;
  }): Promise<ReviewRunDetail>;
  listAiReviews(input: {
    sessionId: string;
  }): Promise<ReviewRun[]>;
  publishAiReview(input: {
    runId: string;
  }): Promise<unknown>;
  startAiReview(input: {
    request: {
      sessionId: string;
      provider: AiProviderId;
      authMode: string;
      model: string;
      baseUrl: string;
      reviewerRole: BotCategory;
      instructions: string;
      allowRemote: boolean;
      executionMode: "provider" | "acp";
      acpAgent: AcpAgentConfig | null;
      acpConfigOptions: AcpReviewConfigOverrides | null;
      reasoningEffort: AiReasoningEffort | null;
      fastMode: boolean;
      reviewerId: string | null;
      reviewerName: string | null;
      generateDescription: boolean;
      replyDiscussionId?: string;
    };
  }): Promise<ReviewRun>;
}
