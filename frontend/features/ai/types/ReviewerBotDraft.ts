import type { BotCategory } from '../../virtual-mr/types/BotCategory';
import type { AcpReviewConfigOverrides } from './AcpReviewConfigOverrides';
import type { AiReasoningEffort } from './AiReasoningEffort';
export interface ReviewerBotDraft {
  formName: string;
  formTagline: string;
  formDesc: string;
  formCategory: BotCategory;
  formEmoji: string;
  formInstructions: string;
  formExecutionMode: 'provider' | 'acp';
  formAcpAgentId: string;
  formAllowAcpSourceTransfer: boolean;
  formAcpConfigOptions: AcpReviewConfigOverrides;
  formProvider: string;
  formModel: string;
  formTemp: number;
  formReasoningEffort: AiReasoningEffort | undefined;
  formFastMode: boolean;
}
