import type { AiProviderId } from './AiProviderId';
import type { AiModelPreset } from './AiModelPreset';

export interface AiProviderPreset {
  id: AiProviderId;
  name: string;
  description: string;
  defaultBaseUrl: string;
  /** Default preference/migration metadata; model pickers must use provider API catalogs. */
  defaultModel: string;
  /** Capability metadata for IDs returned by the provider API, never a selectable catalog. */
  models: AiModelPreset[];
  requiresApiKey: boolean;
  docUrl: string;
}
