import { type AiConfig } from '../types/AiConfig';

export interface AiProviderDetailsContext {
  aiConfig: AiConfig;
  setProvider: (providerId: AiConfig['provider']) => void;
}
