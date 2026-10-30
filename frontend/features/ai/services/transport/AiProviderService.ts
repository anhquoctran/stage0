import type { AiProviderId } from '../../types/AiProviderId';
import type { AiReasoningEffort } from '../../types/AiReasoningEffort';
import type { GuardrailPolicy } from '../../types/GuardrailPolicy';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface AiProviderService {
  commitAiPreferences(input: {
    apiKeys: Record<string, string>;
    apiKeyRemovals: AiProviderId[];
    policy: GuardrailPolicy | null;
    mcpEnvSecrets: Record<string, Record<string, string>>;
    mcpEnvRemovals: Record<string, string[]>;
  }): Promise<Partial<Record<AiProviderId, boolean>>>;
  deleteAiApiKey(input: {
    provider: AiProviderId;
  }): Promise<unknown>;
  fetchAiModels(input: {
    provider: AiProviderId;
    /** One-time form input; the backend uses it only for this model-list request. */
    apiKey: string | null;
    baseUrl: string | null;
  }): Promise<{
    id: string;
    name: string;
    description?: string;
    reasoningEfforts?: AiReasoningEffort[] | null;
    supportsFastMode?: boolean | null;
  }[]>;
  hasAiApiKey(input: {
    provider: AiProviderId;
  }): Promise<boolean>;
  storeAiApiKey(input: {
    provider: unknown;
    apiKey: string;
  }): Promise<unknown>;
  testAiReviewProvider(input: {
    request: {
      sessionId: string;
      provider: "openai" | "anthropic" | "gemini" | "xai_grok" | "deepseek" | "qwen" | "kimi" | "custom";
      authMode: string;
      model: string;
      baseUrl: string;
      instructions: string;
      allowRemote: boolean;
      reasoningEffort: AiReasoningEffort | null;
      fastMode: boolean;
    };
  }): Promise<{
    success: boolean;
    message: string;
  }>;
}
