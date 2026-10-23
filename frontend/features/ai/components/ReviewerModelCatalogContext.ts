import type { AiConfig } from '../types/AiConfig';
import type { AiModelPreset } from '../types/AiModelPreset';
import type { AiProviderId } from '../types/AiProviderId';

export interface ReviewerModelCatalogContext {
  formProvider: string;
  globalAiConfig: AiConfig;
  formModel: string;
  dynamicModels: Partial<Record<AiProviderId, AiModelPreset[]>>;
}
