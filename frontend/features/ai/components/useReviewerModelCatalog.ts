import { useMemo } from 'react';
import { AI_PROVIDERS } from '../constants/aiPresets';
import { resolveAiModelPreset } from '../utils/resolveAiModelPreset';
import { getProviderModelCatalog } from '../utils/providerModelCatalog';
import { providerSettingsFor } from '../utils/aiProviderSettings';
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

  const providerSettings = providerPreset
    ? providerSettingsFor(globalAiConfig, providerPreset.id)
    : undefined;
  const executionBaseUrl = providerSettings?.baseUrl || providerPreset?.defaultBaseUrl || '';
  const availableModels = useMemo(
    () => getProviderModelCatalog(dynamicModels, effectiveProvider, executionBaseUrl),
    [dynamicModels, effectiveProvider, executionBaseUrl],
  );

  const executionModelId = inheritsGlobalModel
    ? globalAiConfig.model
    : formModel === 'global_default'
      ? ''
      : formModel;
  const executionModel = resolveAiModelPreset(
    effectiveProvider,
    executionModelId,
    executionBaseUrl,
    availableModels,
  );

  return {
    inheritsGlobalModel,
    executionModel,
    effectiveProvider,
    availableModels,
    executionBaseUrl,
  };
}
