import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { AiProviderService } from './AiProviderService';

export function createAiProviderService(transport: CommandTransport): AiProviderService {
  return {
    commitAiPreferences: (input) => transport.executeCommand('commit_ai_preferences', input),
    deleteAiApiKey: (input) => transport.executeCommand('delete_ai_api_key', input),
    fetchAiModels: (input) => transport.executeCommand('fetch_ai_models', input),
    hasAiApiKey: (input) => transport.executeCommand('has_ai_api_key', input),
    storeAiApiKey: (input) => transport.executeCommand('store_ai_api_key', input),
    testAiReviewProvider: (input) => transport.executeCommand('test_ai_review_provider', input),
  };
}
