import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { AI_PROVIDERS } from '../../constants/aiPresets';
import {
  CUSTOM_MODEL_OPTION,
} from '../../constants/botReviewerConstants';
import type { AiReasoningEffort } from '../../types/AiReasoningEffort';
import { resolveAiModelPreset } from '../../utils/resolveAiModelPreset';
import { AcpReviewerConfigOptions } from '../AcpReviewerConfigOptions';
import { AiModelExecutionOptions } from '../AiModelExecutionOptions';
import type { BotExecutionModelFormProps } from './BotExecutionModelFormProps';

export function BotExecutionModelForm({
  execution: {
    formExecutionMode,
    setFormExecutionMode,
    setFormReasoningEffort,
    setFormFastMode,
    formProvider,
    setFormProvider,
    setIsCustomModel,
    setFormModel,
    isCustomModel,
    formModel,
    formReasoningEffort,
    formTemp,
    setFormTemp,
    formFastMode,
  },
  catalog: {
    modelOptions,
    availableModels,
    globalAiConfig,
    providerPreset,
    effectiveProvider,
    executionBaseUrl,
    dynamicModels,
    inheritsGlobalModel,
    executionModel,
  },
  acp: {
    acpConfig,
    externalAgents,
    formAcpAgentId,
    setFormAcpAgentId,
    setFormAcpConfigOptions,
    formAcpConfigOptions,
    formAllowAcpSourceTransfer,
    setFormAllowAcpSourceTransfer,
  },
}: BotExecutionModelFormProps) {
  const { t } = useTranslation();
  const executionOptions = [
    { value: 'provider' as const, label: t('ai.execution.builtInProvider') },
    { value: 'acp' as const, label: t('ai.execution.acpAgent') },
  ];
  const providerOptions = [
    { value: 'global_default', label: t('ai.execution.globalDefaultFromAiTab') },
    ...AI_PROVIDERS.map((provider) => ({ value: provider.id, label: provider.name })),
  ];
  return (
    <div className="p-3 bg-surface0/30 border border-surface0 space-y-3 rounded-sm">
      <span className="text-[11px] font-bold text-text uppercase tracking-wider block">
        {t('ai.execution.sectionTitle')}
      </span>
      <div>
        <label className="block text-[10px] text-subtext0 mb-1">{t('ai.execution.engine')}</label>
        <CustomSelect
          value={formExecutionMode}
          options={executionOptions}
          onChange={(mode) => {
            setFormExecutionMode(mode);
            setFormReasoningEffort(undefined);
            setFormFastMode(false);
          }}
          className="w-full"
          buttonClassName="w-full"
          dropdownWidth="w-full"
          align="left"
          aria-label={t('ai.execution.engine')}
        />
      </div>
      {formExecutionMode === 'provider' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-subtext0 mb-1">{t('ai.execution.provider')}</label>
              <CustomSelect
                value={formProvider}
                options={providerOptions}
                onChange={(p) => {
                  setFormProvider(p);
                  setIsCustomModel(false);
                  setFormReasoningEffort(undefined);
                  setFormFastMode(false);
                  if (p === 'global_default') {
                    setFormModel('global_default');
                  } else {
                    const nextPreset = AI_PROVIDERS.find((provider) => provider.id === p);
                    setFormModel(nextPreset?.defaultModel || 'global_default');
                  }
                }}
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label={t('ai.execution.providerOverride')}
              />
            </div>

            <div>
              <label className="block text-[10px] text-subtext0 mb-1">{t('ai.execution.model')}</label>
              <CustomSelect
                value={isCustomModel ? CUSTOM_MODEL_OPTION : formModel}
                options={modelOptions}
                onChange={(model) => {
                  if (model === CUSTOM_MODEL_OPTION) {
                    setIsCustomModel(true);
                    if (
                      formModel === 'global_default' ||
                      availableModels.some((item) => item.id === formModel)
                    )
                      setFormModel('');
                    setFormReasoningEffort(undefined);
                    setFormFastMode(false);
                  } else {
                    setIsCustomModel(false);
                    setFormModel(model);
                    const nextModelId =
                      model === 'global_default'
                        ? formProvider === 'global_default'
                          ? globalAiConfig.model
                          : providerPreset?.defaultModel || ''
                        : model;
                    const nextModel = resolveAiModelPreset(
                      effectiveProvider,
                      nextModelId,
                      executionBaseUrl,
                      dynamicModels[effectiveProvider as keyof typeof dynamicModels] || []
                    );
                    if (
                      !nextModel?.reasoningEfforts?.includes(
                        formReasoningEffort as AiReasoningEffort
                      )
                    ) {
                      setFormReasoningEffort(undefined);
                    }
                    if (!nextModel?.supportsFastMode) setFormFastMode(false);
                  }
                }}
                searchable
                searchPlaceholder={t('ai.execution.searchModels')}
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label={t('ai.execution.modelOverride')}
              />
              {isCustomModel && (
                <input
                  type="text"
                  aria-label={t('ai.execution.customModelId')}
                  required
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder={t('ai.execution.enterCustomModelId')}
                  className="mt-2 w-full px-2 py-1.5 bg-surface0 border border-surface1 text-xs text-text focus:outline-none focus:border-brand font-mono rounded-sm"
                />
              )}
            </div>

            <div>
              <label className="block text-[10px] text-subtext0 mb-1">
                {t('ai.execution.temperature', { temperature: formTemp })}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={formTemp}
                onChange={(e) => setFormTemp(parseFloat(e.target.value))}
                className="w-full mt-2 cursor-pointer rounded-sm accent-brand"
              />
            </div>
          </div>
          <div className="pt-2 border-t border-surface0/70 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
              {t('ai.execution.reasoningAndProcessing')}
            </span>
            {inheritsGlobalModel ? (
              <p className="text-[10px] text-subtext0">
                {t('ai.execution.inheritsGlobalModel')}
              </p>
            ) : (
              <AiModelExecutionOptions
                model={executionModel}
                reasoningEffort={formReasoningEffort}
                fastMode={formFastMode}
                onReasoningEffortChange={setFormReasoningEffort}
                onFastModeChange={setFormFastMode}
                emptyMessage={t('ai.execution.noProviderCapabilities')}
              />
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3 border border-surface0 bg-crust/50 p-3 rounded-sm">
          <div>
            <label className="block text-[10px] text-subtext0 mb-1">{t('ai.execution.installedAcpAgent')}</label>
            {externalAgents.length > 0 ? (
              <CustomSelect
                value={formAcpAgentId}
                options={externalAgents.map((agent) => ({
                  value: agent.id,
                  label: `${agent.name}${agent.version ? ` · ${agent.version}` : ''}`,
                  description: agent.description || agent.source,
                }))}
                onChange={(agentId) => {
                  setFormAcpAgentId(agentId);
                  setFormAcpConfigOptions({});
                }}
                searchable
                searchPlaceholder={t('ai.execution.searchInstalledAgents')}
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label={t('ai.execution.acpReviewerAgent')}
              />
            ) : (
              <p className="border border-yellow/40 bg-yellow/5 p-2 text-[10px] text-yellow">
                {t('ai.execution.noAcpAgents')}
              </p>
            )}
          </div>
          <AcpReviewerConfigOptions
            agent={externalAgents.find((agent) => agent.id === formAcpAgentId)}
            value={formAcpConfigOptions}
            state={acpConfig}
          />
          <label className="flex items-start gap-2 text-[10px] text-subtext0">
            <input
              type="checkbox"
              checked={formAllowAcpSourceTransfer}
              onChange={(event) => setFormAllowAcpSourceTransfer(event.target.checked)}
              className="mt-0.5 accent-brand"
            />
            <span>
              {t('ai.execution.acpConsent')}
            </span>
          </label>
          <p className="text-[10px] text-subtext0">
            {t('ai.execution.acpTrustBoundary')}
          </p>
        </div>
      )}
    </div>
  );
}
