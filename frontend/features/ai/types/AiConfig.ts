import type { AiProviderId } from './AiProviderId';
import type { AiReasoningEffort } from './AiReasoningEffort';
import type { AiProviderSettings } from './AiProviderSettings';

export interface AiConfig {
  provider: AiProviderId;
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
  /** Non-secret connection details remembered separately for each built-in provider. */
  providerSettings?: Partial<Record<AiProviderId, AiProviderSettings>>;
  /** Providers the user explicitly added to Preferences. */
  configuredProviders?: AiProviderId[];
  /** Display name for the single OpenAI-compatible custom endpoint. */
  customProviderName?: string;
}
