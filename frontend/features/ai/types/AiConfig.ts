import type { AiProviderId } from './AiProviderId';
import type { AiAuthMode } from './AiAuthMode';

export interface AiConfig {
  provider: AiProviderId;
  authMode?: AiAuthMode;
  cliType?: 'claude' | 'gh_copilot' | 'gcloud' | 'grok';
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  streamResponse: boolean;
  enableCodeReviewAssist: boolean;
}
