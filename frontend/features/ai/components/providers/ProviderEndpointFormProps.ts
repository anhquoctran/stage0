import { type AiConfig } from '../../types/AiConfig';
import type { AiProviderPreset } from '../../types/AiProviderPreset';

export interface ProviderEndpointFormProps {
  aiConfig: AiConfig;
  activeProviderPreset: AiProviderPreset;
  onUpdateAiConfig: (partial: Partial<AiConfig>) => void;
  dynamicModels: Record<string, any[]>;
}
