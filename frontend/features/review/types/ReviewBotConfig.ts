import type { AiConfig } from '../../ai/types/AiConfig';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';

export type ReviewBotConfig = AiConfig & {
  reviewerRole: BotCategory;
  customInstructions: string;
};
