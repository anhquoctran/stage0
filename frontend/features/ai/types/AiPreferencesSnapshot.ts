import type { AiConfig } from './AiConfig';
import type { McpServerConfig } from './McpServerConfig';
import type { GuardrailPolicy } from './GuardrailPolicy';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';

export interface AiPreferencesSnapshot {
  aiConfig: AiConfig;
  mcpServers: McpServerConfig[];
  guardrailPolicy: GuardrailPolicy;
  globalReviewers: BotReviewer[];
}
