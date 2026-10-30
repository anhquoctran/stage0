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
  const model = dynamic || preset;
  if (!model) return undefined;

  const root = baseUrl.replace(/\/+$/, '');
  if (!((providerId === 'openai' && root === OPENAI_API_BASE_URL) ||
    (providerId === 'anthropic' && root === 'https://api.anthropic.com/v1' && dynamic))) {
    return { id: model.id, name: model.name, recommendedFor: model.recommendedFor };
  }
  return model;
}
