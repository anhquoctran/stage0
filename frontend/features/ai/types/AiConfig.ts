import type { AiProviderId } from './AiProviderId';
import type { AiAuthMode } from './AiAuthMode';
import type { AiReasoningEffort } from './AiReasoningEffort';

export interface AiConfig {
  provider: AiProviderId;
  authMode?: AiAuthMode;
  cliType?: 'claude' | 'gh_copilot' | 'gcloud' | 'grok';
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  reasoningEffort?: AiReasoningEffort;
  fastMode?: boolean;
  maxTokens: number;
  reviewerInstructions: string;
  streamResponse: boolean;
  enableCodeReviewAssist: boolean;
}
