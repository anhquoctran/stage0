import type { AiPreferencesSnapshot } from './AiPreferencesSnapshot';
import type { AiMcpState } from './AiMcpState';
import type { BotReviewersState } from './BotReviewersState';
import type { AiProviderId } from './AiProviderId';

export type AiPreferencesEditor = AiPreferencesSnapshot & Pick<AiMcpState,
  'updateAiConfig' | 'addMcpServer' | 'updateMcpServer' | 'deleteMcpServer' | 'toggleMcpServer' |
  'testMcpServer' | 'importMcpConfigFile' | 'exportMcpConfigFile' | 'updateGuardrailPolicy' | 'resetGuardrailPolicy' | 'updateExternalAgents'> & Pick<BotReviewersState,
  'addGlobalReviewer' | 'updateGlobalReviewer' | 'deleteGlobalReviewer' | 'toggleGlobalReviewer' | 'resetGlobalReviewers'> & {
    apiKeyDrafts: Partial<Record<AiProviderId, string>>;
    apiKeyRemovals: AiProviderId[];
    removeApiKey: (provider: AiProviderId) => void;
    replace: (snapshot: AiPreferencesSnapshot) => void;
  };
