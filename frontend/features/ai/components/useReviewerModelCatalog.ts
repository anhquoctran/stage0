import { useMemo } from 'react';
import { AI_PROVIDERS } from '../constants/aiPresets';
import type { AiModelPreset } from '../types/AiModelPreset';
import { resolveAiModelPreset } from '../utils/resolveAiModelPreset';
import type { ReviewerModelCatalogContext } from './ReviewerModelCatalogContext';

export function useReviewerModelCatalog({
  formProvider,
  globalAiConfig,
  formModel,
  dynamicModels,
}: ReviewerModelCatalogContext) {
  const effectiveProvider =
    formProvider === 'global_default' ? globalAiConfig.provider : formProvider;

  const providerPreset = AI_PROVIDERS.find((provider) => provider.id === effectiveProvider);

  const inheritsGlobalModel = formProvider === 'global_default' && formModel === 'global_default';

  const availableModels = useMemo(() => {
    const candidates = [
      ...(providerPreset ? dynamicModels[providerPreset.id] || [] : []),
      ...(providerPreset?.models || []),
    ];
    if (
      effectiveProvider === globalAiConfig.provider &&
      globalAiConfig.model &&
      !candidates.some((model) => model.id === globalAiConfig.model)
    ) {
      candidates.push({ id: globalAiConfig.model, name: globalAiConfig.model });
    }
    const models = new Map<string, AiModelPreset>();
    for (const model of candidates)
      if (model.id && !models.has(model.id)) models.set(model.id, model);
    return [...models.values()];
  }, [
    dynamicModels,
    providerPreset,
    effectiveProvider,
    globalAiConfig.provider,
    globalAiConfig.model,
  ]);

  const executionModelId = inheritsGlobalModel
    ? globalAiConfig.model
    : formModel === 'global_default'
      ? providerPreset?.defaultModel || globalAiConfig.model
      : formModel;

  const executionBaseUrl =
    (formProvider === 'global_default' ? globalAiConfig.baseUrl : providerPreset?.defaultBaseUrl) ||
    '';

  const executionModel = resolveAiModelPreset(
    effectiveProvider,
    executionModelId,
    executionBaseUrl,
    dynamicModels[effectiveProvider as keyof typeof dynamicModels] || []
  );

  return {
    inheritsGlobalModel,
    executionModel,
    providerPreset,
    effectiveProvider,
    availableModels,
    executionBaseUrl,
  };
}
