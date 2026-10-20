import type { AiReasoningEffort } from './AiReasoningEffort';

export interface AiProviderSettings {
  model: string;
  baseUrl: string;
  reasoningEffort?: AiReasoningEffort;
  fastMode?: boolean;
}
