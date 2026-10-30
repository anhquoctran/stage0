import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { AI_PROVIDERS } from '../../constants/aiPresets';
import type { AiProviderId } from '../../types/AiProviderId';
import { configuredProviderIds, providerSettingsFor } from '../../utils/aiProviderSettings';
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
    setFormModel,
    formModel,
    formReasoningEffort,
    formTemp,
    setFormTemp,
    formFastMode,
  },
  catalog: {
    modelOptions,
    globalAiConfig,
    effectiveProvider,
    fetchDynamicModels,
    isFetchingDynamicModels,
    dynamicModelError,
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
  const configuredProviders = configuredProviderIds(globalAiConfig);
  const providerOptions = [
    ...(formProvider === 'global_default'
      ? [{ value: 'global_default', label: t('ai.execution.globalDefaultFromAiTab') }]
      : []),
    ...AI_PROVIDERS
      .filter((provider) => configuredProviders.includes(provider.id) || provider.id === formProvider)
      .map((provider) => ({ value: provider.id, label: provider.name })),
  ];
  const loadModels = async (providerValue: string) => {
    if (!providerValue || providerValue === 'global_default') return;
    const provider = providerValue as AiProviderId;
    const settings = providerSettingsFor(globalAiConfig, provider);
    await fetchDynamicModels({
      ...globalAiConfig,
      ...settings,
      provider,
      apiKey: provider === globalAiConfig.provider ? globalAiConfig.apiKey : '',
    });
  };
  const refreshModels = () => loadModels(effectiveProvider);
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
                  setFormReasoningEffort(undefined);
                  setFormFastMode(false);
                  if (p === 'global_default') {
                    setFormModel('global_default');
                  } else {
                    setFormModel('');
                    void loadModels(p);
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
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-[10px] text-subtext0">{t('ai.execution.model')}</label>
                {!!formProvider && formProvider !== 'global_default' && (
                  <button
                    type="button"
                    disabled={isFetchingDynamicModels}
                    onClick={() => void refreshModels()}
                    title={t('ai.providerModel.refreshModelsTitle')}
                    className="rounded-sm text-[10px] text-subtext0 hover:text-text disabled:opacity-40"
                  >
                    {isFetchingDynamicModels ? t('ai.providerModel.refreshing') : t('ai.providerModel.refreshModels')}
                  </button>
                )}
              </div>
              <CustomSelect
                value={formModel}
                options={modelOptions}
                disabled={
                  isFetchingDynamicModels ||
                  (!modelOptions.length && formProvider !== 'global_default')
                }
                onChange={(model) => {
                  setFormModel(model);
                  setFormReasoningEffort(undefined);
                  setFormFastMode(false);
                }}
                searchable
                searchPlaceholder={t('ai.execution.searchModels')}
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label={t('ai.execution.modelOverride')}
              />
              {dynamicModelError && formProvider !== 'global_default' && (
                <p role="alert" className="mt-1 text-[10px] text-red">{dynamicModelError}</p>
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
