import type { AiConfig } from '../../ai/types/AiConfig';
import type { AiModelPreset } from '../../ai/types/AiModelPreset';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import type { ReviewBotConfig } from '../types/ReviewBotConfig';
import { AI_PROVIDERS } from '../../ai/constants/aiPresets';
import { resolveAiModelPreset } from '../../ai/utils/resolveAiModelPreset';

export function resolveReviewBotConfig(
  globalConfig: AiConfig,
  reviewer: BotReviewer,
  dynamicModels: AiModelPreset[] = [],
): ReviewBotConfig {
  const provider = reviewer.provider && reviewer.provider !== 'global_default'
    ? reviewer.provider as AiConfig['provider']
    : globalConfig.provider;
  const providerPreset = AI_PROVIDERS.find((item) => item.id === provider);
  const usesGlobalModel = (!reviewer.provider || reviewer.provider === 'global_default')
    && (!reviewer.model || reviewer.model === 'global_default');
  const model = reviewer.model && reviewer.model !== 'global_default'
    ? reviewer.model
    : reviewer.provider && reviewer.provider !== 'global_default'
      ? providerPreset?.defaultModel || globalConfig.model
      : provider === globalConfig.provider
        ? globalConfig.model
        : providerPreset?.defaultModel || globalConfig.model;
  const baseUrl = provider === globalConfig.provider
    ? globalConfig.baseUrl
    : providerPreset?.defaultBaseUrl || globalConfig.baseUrl;

  if (usesGlobalModel) {
    return {
      ...globalConfig,
      reviewerRole: reviewer.category,
      customInstructions: reviewer.customInstructions,
    };
  }

  const capabilities = resolveAiModelPreset(provider, model, baseUrl, dynamicModels);
  const reasoningEffort = reviewer.reasoningEffort
    && capabilities?.reasoningEfforts?.includes(reviewer.reasoningEffort)
    ? reviewer.reasoningEffort
    : undefined;

  return {
    ...globalConfig,
    provider,
    model,
    baseUrl,
    reviewerRole: reviewer.category,
    customInstructions: reviewer.customInstructions,
    reasoningEffort,
    fastMode: capabilities?.supportsFastMode === true && reviewer.fastMode === true,
  };
}
