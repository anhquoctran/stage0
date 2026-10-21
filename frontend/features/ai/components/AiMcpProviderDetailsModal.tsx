import React, { useState } from 'react';
import { ExternalLink } from '../../../common/components/icons/ExternalLink';
import { X } from '../../../common/components/icons/X';
import { Eye } from '../../../common/components/icons/Eye';
import { EyeOff } from '../../../common/components/icons/EyeOff';
import { ShieldCheck } from '../../../common/components/icons/ShieldCheck';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { RotateCcw } from '../../../common/components/icons/RotateCcw';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { AiModelExecutionOptions } from './AiModelExecutionOptions';
import { MAX_TOKEN_OPTIONS, openUrlInBrowser } from '../constants/aiMcpConstants';
import { resolveAiModelPreset } from '../utils/resolveAiModelPreset';
import { getProviderIcon } from '../utils/getProviderIcon';
import { getProviderDisplayName } from '../utils/getProviderDisplayName';
import { type AiConfig } from '../types/AiConfig';
import { type AiProviderId } from '../types/AiProviderId';
import { AI_PROVIDERS } from '../constants/aiPresets';

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
  const [showApiKey, setShowApiKey] = useState(false);

  const ActiveProviderIcon = getProviderIcon(activeProviderPreset.id);

  const currentDynamic = dynamicModels[aiConfig.provider];
  const modelsList = currentDynamic && currentDynamic.length > 0 ? currentDynamic : activeProviderPreset.models;
  const selectedModelInfo = resolveAiModelPreset(aiConfig.provider, aiConfig.model, aiConfig.baseUrl, modelsList);

  const selectModel = (model: string) => {
    const nextModel = resolveAiModelPreset(aiConfig.provider, model, aiConfig.baseUrl, modelsList);
    onUpdateAiConfig({
      model,
      reasoningEffort: nextModel?.reasoningEfforts?.includes(aiConfig.reasoningEffort as NonNullable<AiConfig['reasoningEffort']>)
        ? aiConfig.reasoningEffort
        : undefined,
      fastMode: nextModel?.supportsFastMode ? aiConfig.fastMode : false,
    });
  };

  const modelOptions: CustomSelectOption<string>[] = [
    ...(aiConfig.model && !modelsList.some((model) => model.id === aiConfig.model)
      ? [{ value: aiConfig.model, label: `${aiConfig.model} (Custom / Active)` }]
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
          className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-[var(--backdrop-modal)] backdrop-blur-xs"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        className={`p-4 border border-surface1 space-y-4 ${
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
                  {aiConfig.provider === 'ollama' ? 'Offline Local' : 'API Key'}
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
                <span>Documentation</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-subtext0 hover:text-text transition-colors cursor-pointer"
              aria-label="Close provider details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {aiConfig.provider === 'custom' && (
          <div>
            <label htmlFor="custom-provider-display-name" className="block text-xs font-semibold text-text mb-1">
              Provider display name
            </label>
            <input
              id="custom-provider-display-name"
              value={aiConfig.customProviderName || ''}
              onChange={(event) => onUpdateAiConfig({ customProviderName: event.target.value })}
              placeholder="e.g. OpenRouter, DeepSeek, LM Studio"
              className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2"
            />
          </div>
        )}

        {/* API key section */}
        <div className="space-y-2.5">
          {activeProviderPreset.requiresApiKey ? (
            <div className="p-3 bg-base/60 border border-surface1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-text">
                  API Secret Key <span className="text-red">*</span>
                </label>
                <span className="text-[10px] text-green/90 font-mono">
                  {apiKeyDraft.trim() && hasDraftSettings
                    ? 'Pending key change · Apply or OK to save'
                    : hasSavedApiKey
                    ? '✓ Stored securely in OS Keyring'
                    : apiKeysConfigured[aiConfig.provider] === false
                    ? 'No saved key found'
                    : 'Saved key not checked'}
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyDraft}
                  onChange={(event) => {
                    const value = event.target.value;
                    setApiKeyDraft(value);
                    onUpdateAiConfig({ apiKey: value });
                  }}
                  placeholder={
                    hasSavedApiKey
                      ? 'Key saved securely. Enter a new key to replace it.'
                      : 'Paste your provider API key'
                  }
                  className="w-full px-3 pr-10 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2.5 p-1 text-subtext0 hover:text-text cursor-pointer"
                  title={showApiKey ? 'Hide secret key' : 'Show secret key'}
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button
                type="button"
                disabled={isCheckingApiKey}
                onClick={() => void onLoadApiKey(aiConfig.provider)}
                className="mt-2 border border-surface1 px-2.5 py-1 text-[11px] disabled:opacity-40"
                title="Checks only whether a key is saved in the OS keyring."
              >
                {isCheckingApiKey ? 'Checking…' : 'Check saved API key'}
              </button>
              {apiKeyCheckError && <p role="alert" className="mt-2 text-red">{apiKeyCheckError}</p>}
            </div>
          ) : (
            <div className="p-3 bg-base/60 border border-surface1 flex items-center gap-2.5 text-xs text-subtext0">
              <ShieldCheck className="w-4 h-4 text-green shrink-0" />
              <span>Ollama runs locally on this machine (http://localhost:11434) and does not need an API key.</span>
            </div>
          )}
        </div>

        {/* Model selection & inference parameters */}
        <div className="space-y-3 pt-3 border-t border-surface1/60">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text">Model</label>
              <button
                type="button"
                disabled={isFetchingDynamicModels || !!apiKeyDraft.trim()}
                onClick={() => void onFetchDynamicModels(aiConfig)}
                className="text-[11px] text-subtext0 hover:text-text disabled:opacity-40"
                title="Refresh models using saved API credentials. Apply key changes first."
              >
                {isFetchingDynamicModels ? 'Refreshing…' : 'Refresh models'}
              </button>
            </div>
            <CustomSelect
              value={aiConfig.model}
              options={modelOptions}
              onChange={selectModel}
              className="w-full"
              buttonClassName="w-full py-2 font-mono"
              dropdownWidth="w-full"
              align="left"
              aria-label="Model"
            />
            {dynamicModelError && <p role="alert" className="mt-1 text-xs text-red">{dynamicModelError}</p>}
            {selectedModelInfo?.recommendedFor && (
              <div className="text-[10px] text-subtext0 italic px-1 mt-1">
                Recommended: {selectedModelInfo.recommendedFor}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-text">
                  Temperature: <span className="font-mono text-text">{aiConfig.temperature}</span>
                </label>
                <span className="text-[10px] text-subtext0 font-mono">
                  {aiConfig.temperature <= 0.2 ? 'Deterministic' : 'Balanced'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={aiConfig.temperature}
                onChange={(e) => onUpdateAiConfig({ temperature: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-surface1 appearance-none cursor-pointer accent-text"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-text">Max Output Tokens</label>
                <span className="text-[10px] text-subtext0 font-mono">{aiConfig.maxTokens} tokens</span>
              </div>
              <CustomSelect
                value={String(aiConfig.maxTokens)}
                options={MAX_TOKEN_OPTIONS}
                onChange={(tokens) => onUpdateAiConfig({ maxTokens: parseInt(tokens, 10) })}
                className="w-full"
                buttonClassName="w-full font-mono"
                dropdownWidth="w-full"
                align="left"
                aria-label="Max Output Tokens"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-surface1/60">
            <AiModelExecutionOptions
              model={selectedModelInfo}
              reasoningEffort={aiConfig.reasoningEffort}
              fastMode={aiConfig.fastMode === true}
              onReasoningEffortChange={(reasoningEffort) => onUpdateAiConfig({ reasoningEffort })}
              onFastModeChange={(fastMode) => onUpdateAiConfig({ fastMode })}
              emptyMessage="Stage0 has no declared reasoning or Fast mode capabilities for this provider and model."
            />
          </div>
        </div>

        {/* Network endpoint & behavior options */}
        <div className="space-y-3 pt-3 border-t border-surface1/60">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-text">API Base URL / Endpoint</label>
              {aiConfig.baseUrl !== activeProviderPreset.defaultBaseUrl && (
                <button
                  type="button"
                  onClick={() => onUpdateAiConfig({ baseUrl: activeProviderPreset.defaultBaseUrl })}
                  className="text-[10px] text-subtext0 hover:text-text underline cursor-pointer"
                >
                  Reset default ({activeProviderPreset.defaultBaseUrl})
                </button>
              )}
            </div>
            <input
              type="text"
              value={aiConfig.baseUrl}
              onChange={(e) => {
                const baseUrl = e.target.value;
                const nextModel = resolveAiModelPreset(aiConfig.provider, aiConfig.model, baseUrl, dynamicModels[aiConfig.provider]);
                onUpdateAiConfig({ baseUrl, reasoningEffort: undefined, fastMode: nextModel?.supportsFastMode ? aiConfig.fastMode : false });
              }}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2"
            />
          </div>

          <div className="flex items-center justify-between gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-text select-none">
              <input
                type="checkbox"
                checked={aiConfig.streamResponse}
                onChange={(e) => onUpdateAiConfig({ streamResponse: e.target.checked })}
                className="w-4 h-4 accent-text cursor-pointer"
              />
              <span>Stream responses in real-time</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-text select-none">
              <input
                type="checkbox"
                checked={aiConfig.enableCodeReviewAssist}
                onChange={(e) => onUpdateAiConfig({ enableCodeReviewAssist: e.target.checked })}
                className="w-4 h-4 accent-text cursor-pointer"
              />
              <span>Auto-summarize Git commits &amp; diffs</span>
            </label>
          </div>
        </div>

        {/* Health check & action footer */}
        <div className="pt-3 border-t border-surface1/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTestConnection}
              disabled={isTestingAi}
              title="Native API tests use saved OS credentials, send no repository source and may incur provider charges. Apply API key changes first."
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold transition-colors cursor-pointer border border-surface2 shadow-xs"
            >
              {isTestingAi ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <span>Test Connection</span>
              )}
            </button>

            <button
              type="button"
              onClick={onResetAiConfig}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-subtext0 hover:text-text hover:bg-surface1/40 transition-colors cursor-pointer"
              title="Reset provider settings to defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Inline Test Result */}
          {aiTestResult && (
            <div
              className={`flex items-center gap-2 px-2.5 py-1 text-xs animate-in fade-in ${
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
                className="text-subtext0 hover:text-text cursor-pointer ml-1"
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

