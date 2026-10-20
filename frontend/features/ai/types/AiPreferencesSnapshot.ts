import type { AiConfig } from './AiConfig';
import type { McpServerConfig } from './McpServerConfig';
import type { GuardrailPolicy } from './GuardrailPolicy';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import type { AcpAgentConfig } from './AcpAgentConfig';

export interface AiPreferencesSnapshot {
  aiConfig: AiConfig;
  mcpServers: McpServerConfig[];
  guardrailPolicy: GuardrailPolicy;
  globalReviewers: BotReviewer[];
  externalAgents: AcpAgentConfig[];
}
