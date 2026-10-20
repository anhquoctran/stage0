import type { AiAuthMode } from './AiAuthMode';
import type { AiReasoningEffort } from './AiReasoningEffort';

export interface AiProviderSettings {
  authMode?: AiAuthMode;
  cliType?: 'claude' | 'gh_copilot' | 'gcloud' | 'grok';
  model: string;
  baseUrl: string;
  reasoningEffort?: AiReasoningEffort;
  fastMode?: boolean;
}
