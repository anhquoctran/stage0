import { type AiConfig } from '../types/AiConfig';
import type { AiPreferencesEditor } from '../types/AiPreferencesEditor';
import { type AiProviderId } from '../types/AiProviderId';

export interface AiProviderSetupContext {
  draftSettings: AiPreferencesEditor | undefined;
  apiKeysConfigured: Partial<Record<AiProviderId, boolean>>;
  aiConfig: AiConfig;
  apiKeyDraft: string;
  updateAiConfig: (partial: Partial<AiConfig>) => void;
}
