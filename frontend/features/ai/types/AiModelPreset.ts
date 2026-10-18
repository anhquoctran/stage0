import type { AiReasoningEffort } from './AiReasoningEffort';

export interface AiModelPreset {
  id: string;
  name: string;
  recommendedFor?: string;
  reasoningEfforts?: AiReasoningEffort[];
  supportsFastMode?: boolean;
}
