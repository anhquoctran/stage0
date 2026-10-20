import type { AiConfig } from '../../ai/types/AiConfig';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';
import type { AcpAgentConfig } from '../../ai/types/AcpAgentConfig';
import type { AcpReviewConfigOverrides } from '../../ai/types/AcpReviewConfigOverrides';

export type ReviewBotConfig = AiConfig & {
  reviewerRole: BotCategory;
  customInstructions: string;
  executionMode?: 'provider' | 'acp';
  acpAgent?: AcpAgentConfig;
  acpConfigOptions?: AcpReviewConfigOverrides;
  allowAcpSourceTransfer?: boolean;
};
