import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';
import type { AiConfig } from '../types/AiConfig';
import type { AiModelPreset } from '../types/AiModelPreset';
import type { AiProviderId } from '../types/AiProviderId';

export interface ReviewerBotFormContext {
  globalAiConfig: AiConfig;
  dynamicModels: Partial<Record<AiProviderId, AiModelPreset[]>>;
  externalAgents: AcpAgentConfig[];
  updateGlobalReviewer: (id: string, updates: Partial<BotReviewer>) => void;
  addGlobalReviewer: (bot: Omit<BotReviewer, 'id'>) => string;
}
