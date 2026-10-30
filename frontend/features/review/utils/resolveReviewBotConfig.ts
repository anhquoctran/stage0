import type { AiConfig } from '../../ai/types/AiConfig';
import type { AiModelPreset } from '../../ai/types/AiModelPreset';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import type { ReviewBotConfig } from '../types/ReviewBotConfig';
import type { AcpAgentConfig } from '../../ai/types/AcpAgentConfig';
import { AI_PROVIDERS } from '../../ai/constants/aiPresets';
import { providerSettingsFor } from '../../ai/utils/aiProviderSettings';
import { resolveAiModelPreset } from '../../ai/utils/resolveAiModelPreset';

export function resolveReviewBotConfig(
  globalConfig: AiConfig,
  reviewer: BotReviewer,
  dynamicModels: AiModelPreset[] = [],
  externalAgents: AcpAgentConfig[] = [],
): ReviewBotConfig {
  if (reviewer.acpAgentId) {
    return {
      ...globalConfig,
      reviewerRole: reviewer.category,
      customInstructions: reviewer.customInstructions,
      executionMode: 'acp',
      acpAgent: externalAgents.find((agent) => agent.id === reviewer.acpAgentId),
      acpConfigOptions: reviewer.acpConfigOptions || {},
      allowAcpSourceTransfer: reviewer.allowAcpSourceTransfer === true,
    };
  }

  const provider = reviewer.provider && reviewer.provider !== 'global_default'
    ? reviewer.provider as AiConfig['provider']
    : globalConfig.provider;
  const providerPreset = AI_PROVIDERS.find((item) => item.id === provider);
  const providerSettings = providerSettingsFor(globalConfig, provider);
  const usesGlobalModel = (!reviewer.provider || reviewer.provider === 'global_default')
    && (!reviewer.model || reviewer.model === 'global_default');
  const model = reviewer.model && reviewer.model !== 'global_default'
    ? reviewer.model
    : reviewer.provider && reviewer.provider !== 'global_default'
      ? providerSettings.model || globalConfig.model
      : provider === globalConfig.provider
        ? globalConfig.model
        : providerSettings.model || providerPreset?.defaultModel || globalConfig.model;
  const baseUrl = providerSettings.baseUrl || providerPreset?.defaultBaseUrl || globalConfig.baseUrl;

  if (usesGlobalModel) {
    return {
      ...globalConfig,
      reviewerRole: reviewer.category,
      customInstructions: reviewer.customInstructions,
    };
  }

  const capabilities = resolveAiModelPreset(provider, model, baseUrl, dynamicModels);
  // Anthropic advertises effort per model; the in-memory catalog is empty after
  // restart. Preserve the saved choice and let the provider validate it.
  const anthropicApi = provider === 'anthropic' && baseUrl.replace(/\/+$/, '') === 'https://api.anthropic.com/v1';
  const reasoningEffort = reviewer.reasoningEffort
    && (capabilities?.reasoningEfforts?.includes(reviewer.reasoningEffort)
      || (anthropicApi && !dynamicModels.some((item) => item.id === model)
        && ['low', 'medium', 'high', 'xhigh', 'max'].includes(reviewer.reasoningEffort)))
    ? reviewer.reasoningEffort
    : undefined;

  return {
    ...globalConfig,
    provider,
    model,
    baseUrl,
    reviewerRole: reviewer.category,
    customInstructions: reviewer.customInstructions,
    executionMode: 'provider',
    reasoningEffort,
    fastMode: reviewer.fastMode === true && (capabilities?.supportsFastMode === true ||
      (anthropicApi && model === 'claude-opus-5-5')),
  };
}
