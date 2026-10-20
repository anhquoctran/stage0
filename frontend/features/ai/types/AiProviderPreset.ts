import type { AiProviderId } from './AiProviderId';
import type { AiModelPreset } from './AiModelPreset';

export interface AiProviderPreset {
  id: AiProviderId;
  name: string;
  description: string;
  defaultBaseUrl: string;
  defaultModel: string;
  models: AiModelPreset[];
  requiresApiKey: boolean;
  docUrl: string;
}
