import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { ExternalLink } from '../../../common/components/icons/ExternalLink';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { RotateCcw } from '../../../common/components/icons/RotateCcw';
import { X } from '../../../common/components/icons/X';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { openUrlInBrowser } from '../constants/aiMcpConstants';
import { AI_PROVIDERS } from '../constants/aiPresets';
import { type AiConfig } from '../types/AiConfig';
import { type AiProviderId } from '../types/AiProviderId';
import { getProviderDisplayName } from '../utils/getProviderDisplayName';
import { getProviderIcon } from '../utils/getProviderIcon';
import { resolveAiModelPreset } from '../utils/resolveAiModelPreset';
import { ProviderApiKeyForm } from './providers/ProviderApiKeyForm';
import { ProviderEndpointForm } from './providers/ProviderEndpointForm';
import { ProviderModelForm } from './providers/ProviderModelForm';

export const AiMcpProviderDetailsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  aiConfig: AiConfig;
  activeProviderPreset: (typeof AI_PROVIDERS)[number];
  apiKeyDraft: string;
  setApiKeyDraft: (key: string) => void;
  hasSavedApiKey: boolean;
  apiKeysConfigured: Record<string, boolean>;
  isCheckingApiKey: boolean;
  apiKeyCheckError: string | null;
  onLoadApiKey: (provider: AiProviderId) => void;
  onUpdateAiConfig: (partial: Partial<AiConfig>) => void;
  dynamicModels: Record<string, any[]>;
  isFetchingDynamicModels: boolean;
  dynamicModelError: string | null;
  onFetchDynamicModels: (config: AiConfig) => void;
  onTestConnection: () => void;
  isTestingAi: boolean;
  aiTestResult: { success: boolean; message: string } | null;
  onClearTestResult: () => void;
  onResetAiConfig: () => void;
  hasDraftSettings?: boolean;
}> = ({
  isOpen,
  onClose,
  aiConfig,
  activeProviderPreset,
  apiKeyDraft,
  setApiKeyDraft,
  hasSavedApiKey,
  apiKeysConfigured,
  isCheckingApiKey,
  apiKeyCheckError,
  onLoadApiKey,
  onUpdateAiConfig,
  dynamicModels,
  isFetchingDynamicModels,
  dynamicModelError,
  onFetchDynamicModels,
  onTestConnection,
  isTestingAi,
  aiTestResult,
  onClearTestResult,
  onResetAiConfig,
  hasDraftSettings,
}) => {
  const { t } = useTranslation();
  const [showApiKey, setShowApiKey] = useState(false);

  const ActiveProviderIcon = getProviderIcon(activeProviderPreset.id);

  const currentDynamic = dynamicModels[aiConfig.provider];
  const modelsList =
    currentDynamic && currentDynamic.length > 0 ? currentDynamic : activeProviderPreset.models;
  const selectedModelInfo = resolveAiModelPreset(
    aiConfig.provider,
    aiConfig.model,
    aiConfig.baseUrl,
    modelsList
  );

  const selectModel = (model: string) => {
    const nextModel = resolveAiModelPreset(aiConfig.provider, model, aiConfig.baseUrl, modelsList);
    onUpdateAiConfig({
      model,
      reasoningEffort: nextModel?.reasoningEfforts?.includes(
        aiConfig.reasoningEffort as NonNullable<AiConfig['reasoningEffort']>
      )
        ? aiConfig.reasoningEffort
        : undefined,
      fastMode: nextModel?.supportsFastMode ? aiConfig.fastMode : false,
    });
  };

  const modelOptions: CustomSelectOption<string>[] = [
    ...(aiConfig.model && !modelsList.some((model) => model.id === aiConfig.model)
      ? [{ value: aiConfig.model, label: t('ai.providers.customActiveModel', { model: aiConfig.model }) }]
      : []),
    ...modelsList.map((model) => ({
      value: model.id,
      label: `${model.name || model.id}${model.recommendedFor ? ` — ${model.recommendedFor}` : ''}`,
    })),
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-[var(--backdrop-modal)] backdrop-blur-xs rounded-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        className={`p-4 border border-surface1 space-y-4 rounded-sm ${
          isOpen
            ? 'fixed inset-x-4 top-12 bottom-4 z-60 mx-auto max-w-4xl overflow-y-auto bg-mantle shadow-2xl'
            : 'hidden'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-details-title"
      >
        {/* Header: Active Provider Info & Docs */}
        <div className="flex items-center justify-between pb-3 border-b border-surface1/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-surface1 border border-surface2 flex items-center justify-center text-brand shrink-0">
              <ActiveProviderIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 id="provider-details-title" className="text-xs font-bold text-text">
                  {getProviderDisplayName(activeProviderPreset.id, aiConfig.customProviderName)}
                </h4>
                <span className="text-[10px] px-2 py-0.5 bg-surface1 text-subtext0 border border-surface2 font-mono shrink-0">
                  {aiConfig.provider === 'ollama' ? t('ai.providers.offlineLocal') : t('ai.providers.apiKey')}
                </span>
              </div>
              <p className="text-[11px] text-subtext0 mt-0.5">{activeProviderPreset.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeProviderPreset.docUrl && (
              <a
                href={activeProviderPreset.docUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  if (activeProviderPreset.docUrl) {
                    void openUrlInBrowser(activeProviderPreset.docUrl);
                  }
                }}
                className="flex items-center gap-1 text-[11px] text-subtext0 hover:text-text underline cursor-pointer"
              >
                <span>{t('ai.providers.documentation')}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-subtext0 hover:text-text transition-colors cursor-pointer rounded-sm"
              aria-label={t('ai.providers.closeDetails')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {aiConfig.provider === 'custom' && (
          <div>
            <label
              htmlFor="custom-provider-display-name"
              className="block text-xs font-semibold text-text mb-1"
            >
              {t('ai.providers.displayName')}
            </label>
            <input
              id="custom-provider-display-name"
              value={aiConfig.customProviderName || ''}
              onChange={(event) => onUpdateAiConfig({ customProviderName: event.target.value })}
              placeholder={t('ai.providers.displayNamePlaceholder')}
              className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
            />
          </div>
        )}

        {/* API key section */}
        <ProviderApiKeyForm
          activeProviderPreset={activeProviderPreset}
          apiKeyDraft={apiKeyDraft}
          hasDraftSettings={hasDraftSettings}
          hasSavedApiKey={hasSavedApiKey}
          apiKeysConfigured={apiKeysConfigured}
          aiConfig={aiConfig}
          showApiKey={showApiKey}
          setApiKeyDraft={setApiKeyDraft}
          onUpdateAiConfig={onUpdateAiConfig}
          setShowApiKey={setShowApiKey}
          isCheckingApiKey={isCheckingApiKey}
          onLoadApiKey={onLoadApiKey}
          apiKeyCheckError={apiKeyCheckError}
        />

        {/* Model selection & inference parameters */}
        <ProviderModelForm
          isFetchingDynamicModels={isFetchingDynamicModels}
          apiKeyDraft={apiKeyDraft}
          onFetchDynamicModels={onFetchDynamicModels}
          aiConfig={aiConfig}
          modelOptions={modelOptions}
          selectModel={selectModel}
          dynamicModelError={dynamicModelError}
          selectedModelInfo={selectedModelInfo}
          onUpdateAiConfig={onUpdateAiConfig}
        />

        {/* Network endpoint & behavior options */}
        <ProviderEndpointForm
          aiConfig={aiConfig}
          activeProviderPreset={activeProviderPreset}
          onUpdateAiConfig={onUpdateAiConfig}
          dynamicModels={dynamicModels}
        />

        {/* Health check & action footer */}
        <div className="pt-3 border-t border-surface1/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTestConnection}
              disabled={isTestingAi}
              title={t('ai.providers.testConnectionSafety')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold transition-colors cursor-pointer border border-surface2 shadow-xs rounded-sm"
            >
              {isTestingAi ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('ai.providers.testing')}</span>
                </>
              ) : (
                <span>{t('ai.providers.testConnection')}</span>
              )}
            </button>

            <button
              type="button"
              onClick={onResetAiConfig}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-subtext0 hover:text-text hover:bg-surface1/40 transition-colors cursor-pointer rounded-sm"
              title={t('ai.providers.resetTitle')}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('ai.providers.reset')}</span>
            </button>
          </div>

          {/* Inline Test Result */}
          {aiTestResult && (
            <div
              className={`flex items-center gap-2 px-2.5 py-1 text-xs animate-in fade-in rounded-sm ${
                aiTestResult.success
                  ? 'bg-green/10 text-green border border-green/20'
                  : 'bg-red/10 text-red border border-red/20'
              }`}
            >
              {aiTestResult.success ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate max-w-[280px]">{aiTestResult.message}</span>
              <button
                type="button"
                onClick={onClearTestResult}
                className="text-subtext0 hover:text-text cursor-pointer ms-1 rounded-sm"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
