import { type AiConfig } from '../types/AiConfig';
import type { AiPreferencesEditor } from '../types/AiPreferencesEditor';

export interface AiProviderRemovalContext {
  draftSettings: AiPreferencesEditor | undefined;
  aiConfig: AiConfig;
  updateAiConfig: (partial: Partial<AiConfig>) => void;
}
