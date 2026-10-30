import type { AiConfig } from '../types/AiConfig';
import type { AiModelPreset } from '../types/AiModelPreset';

export interface ReviewerModelCatalogContext {
  formProvider: string;
  globalAiConfig: AiConfig;
  formModel: string;
  dynamicModels: Record<string, AiModelPreset[]>;
}
