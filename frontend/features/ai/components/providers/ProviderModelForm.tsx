import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { AiModelExecutionOptions } from '../AiModelExecutionOptions';
import type { ProviderModelFormProps } from './ProviderModelFormProps';

export function ProviderModelForm({
  isFetchingDynamicModels,
  apiKeyDraft,
  onFetchDynamicModels,
  aiConfig,
  modelOptions,
  selectModel,
  dynamicModelError,
  selectedModelInfo,
  onUpdateAiConfig,
}: ProviderModelFormProps) {
  const { t } = useTranslation();
  const tokenOptions = ['1024', '2048', '4096', '8192', '16384'].map((value) => ({
    value,
    label: t(`ai.providerModel.tokenOptions.${value}`),
  }));
  return (
    <div className="space-y-3 pt-3 border-t border-surface1/60">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-text">{t('ai.execution.model')}</label>
          <button
            type="button"
            disabled={isFetchingDynamicModels || !!apiKeyDraft.trim()}
            onClick={() => void onFetchDynamicModels(aiConfig)}
            className="text-[11px] text-subtext0 hover:text-text disabled:opacity-40 rounded-sm"
            title={t('ai.providerModel.refreshModelsTitle')}
          >
            {isFetchingDynamicModels ? t('ai.providerModel.refreshing') : t('ai.providerModel.refreshModels')}
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
          aria-label={t('ai.execution.model')}
        />
        {dynamicModelError && (
          <p role="alert" className="mt-1 text-xs text-red">
            {dynamicModelError}
          </p>
        )}
        {selectedModelInfo?.recommendedFor && (
          <div className="text-[10px] text-subtext0 italic px-1 mt-1">
            {t('ai.providerModel.recommended')}: {selectedModelInfo.recommendedFor}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-1">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">
              {t('ai.providerModel.temperature', { value: aiConfig.temperature })}
            </label>
            <span className="text-[10px] text-subtext0 font-mono">
              {aiConfig.temperature <= 0.2 ? t('ai.providerModel.deterministic') : t('ai.providerModel.balanced')}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={aiConfig.temperature}
            onChange={(e) => onUpdateAiConfig({ temperature: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-surface1 appearance-none cursor-pointer accent-brand rounded-sm"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-text">{t('ai.providerModel.maxOutputTokens')}</label>
            <span className="text-[10px] text-subtext0 font-mono">{aiConfig.maxTokens} {t('ai.providerModel.tokens')}</span>
          </div>
          <CustomSelect
            value={String(aiConfig.maxTokens)}
            options={tokenOptions}
            onChange={(tokens) => onUpdateAiConfig({ maxTokens: parseInt(tokens, 10) })}
            className="w-full"
            buttonClassName="w-full font-mono"
            dropdownWidth="w-full"
            align="left"
            aria-label={t('ai.providerModel.maxOutputTokens')}
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
          emptyMessage={t('ai.execution.noProviderCapabilities')}
        />
      </div>
    </div>
  );
}
