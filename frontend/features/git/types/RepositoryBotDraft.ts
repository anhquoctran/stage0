import type { AcpReviewConfigOverrides } from '../../ai/types/AcpReviewConfigOverrides';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';
export interface RepositoryBotDraft {
  repoBotName: string;
  repoBotTagline: string;
  repoBotDesc: string;
  repoBotCategory: BotCategory;
  repoBotEmoji: string;
  repoBotInstructions: string;
  repoBotExecutionMode: 'provider' | 'acp';
  repoBotAcpAgentId: string;
  repoBotAllowAcpSourceTransfer: boolean;
  repoBotAcpConfigOptions: AcpReviewConfigOverrides;
}
