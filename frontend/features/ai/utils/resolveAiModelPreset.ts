import { AI_PROVIDERS } from '../constants/aiPresets';
import type { AiModelPreset } from '../types/AiModelPreset';

const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';

export function resolveAiModelPreset(
  providerId: string,
  modelId: string,
  baseUrl: string,
  dynamicModels: AiModelPreset[] = [],
): AiModelPreset | undefined {
  const dynamic = dynamicModels.find((model) => model.id === modelId);
  const preset = AI_PROVIDERS.find((provider) => provider.id === providerId)?.models.find((model) => model.id === modelId);
  const model = preset || dynamic;
  if (!model) return undefined;

  // Only expose the capabilities Stage0 can verify for the official OpenAI API.
  if (providerId !== 'openai' || baseUrl.replace(/\/+$/, '') !== OPENAI_API_BASE_URL) {
    return { id: model.id, name: model.name, recommendedFor: model.recommendedFor };
  }
  return model;
}
