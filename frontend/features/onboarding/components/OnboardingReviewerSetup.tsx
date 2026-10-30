import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { useAiMcpStore } from '../../ai/store/useAiMcpStore';
import { AcpReviewerConfigOptions } from '../../ai/components/AcpReviewerConfigOptions';
import { AiModelExecutionOptions } from '../../ai/components/AiModelExecutionOptions';
import { AI_PROVIDERS } from '../../ai/constants/aiPresets';
import type { AiProviderId } from '../../ai/types/AiProviderId';
import { useAcpReviewerConfigOptions } from '../../ai/hooks/useAcpReviewerConfigOptions';
import type { AiReasoningEffort } from '../../ai/types/AiReasoningEffort';
import type { AcpReviewConfigOverrides } from '../../ai/types/AcpReviewConfigOverrides';
import { EMPTY_PROVIDER_MODELS, getProviderModelCatalog } from '../../ai/utils/providerModelCatalog';
import { providerSettingsFor } from '../../ai/utils/aiProviderSettings';
import { resolveAiModelPreset } from '../../ai/utils/resolveAiModelPreset';
import type { OnboardingReviewerConnection } from '../types/OnboardingReviewerConnection';
import type { OnboardingReviewerSetupProps } from '../types/OnboardingReviewerSetupProps';

export function OnboardingReviewerSetup({
  draftSettings,
  hasSavedRequiredReviewer,
  onAutoSave,
}: OnboardingReviewerSetupProps) {
  const { t: translateUiText } = useUiTextTranslation();
  const { dynamicModels, fetchDynamicModels, isFetchingDynamicModels, dynamicModelError } = useAiMcpStore();
  const [name, setName] = useState(() => translateUiText('onboarding.reviewerSetup.defaultName'));
  const [connectionId, setConnectionId] = useState('');
  const [consentedAcpAgentId, setConsentedAcpAgentId] = useState<string | null>(null);
  const [providerModel, setProviderModel] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<AiReasoningEffort>();
  const [fastMode, setFastMode] = useState(false);
  const [acpConfigOptions, setAcpConfigOptions] = useState<AcpReviewConfigOverrides>({});
  const providerIds = draftSettings.aiConfig.configuredProviders ?? [];
  const providers = AI_PROVIDERS.filter((provider) => providerIds.includes(provider.id)).map((provider) => ({
    id: provider.id,
    value: `provider:${provider.id}`,
    kind: 'provider' as const,
    label: provider.name,
  }));
  const agents = draftSettings.externalAgents
    .filter((agent) => agent.id.trim() && agent.command.trim())
    .map((agent) => ({ id: agent.id, value: `acp:${agent.id}`, kind: 'acp' as const, label: `${agent.name} (ACP)`, agent }));
  const connections: OnboardingReviewerConnection[] = [...providers, ...agents];
  const connectionOptions: CustomSelectOption<string>[] = connections.map((connection) => ({
    value: connection.value,
    label: connection.label,
  }));
  const selected = connections.find((connection) => connection.value === connectionId);
  const selectedProviderId = selected?.kind === 'provider' ? selected.id : undefined;
  const selectedProviderSettings = useMemo(
    () => selectedProviderId ? providerSettingsFor(draftSettings.aiConfig, selectedProviderId) : undefined,
    [draftSettings.aiConfig, selectedProviderId],
  );
  const selectedProviderModels = useMemo(
    () => selectedProviderId && selectedProviderSettings
      ? getProviderModelCatalog(dynamicModels, selectedProviderId, selectedProviderSettings.baseUrl)
      : EMPTY_PROVIDER_MODELS,
    [dynamicModels, selectedProviderId, selectedProviderSettings],
  );
  const selectedAgent = selected?.kind === 'acp' ? selected.agent : undefined;
  const readyReviewer = draftSettings.globalReviewers.find(
    (reviewer) => !reviewer.isBuiltin && reviewer.enabled && reviewer.name.trim()
  );
  const acpConfig = useAcpReviewerConfigOptions(
    !readyReviewer && !!selectedAgent,
    selectedAgent,
    acpConfigOptions,
    setAcpConfigOptions,
  );

  useEffect(() => {
    setProviderModel('');
    setReasoningEffort(undefined);
    setFastMode(false);
    setAcpConfigOptions({});
  }, [selected?.value, selectedProviderId, selectedProviderSettings?.baseUrl]);

  const modelOptions: CustomSelectOption<string>[] = selectedProviderModels.map((model) => ({
    value: model.id,
    label: model.name || model.id,
    description: model.recommendedFor || model.id,
  }));
  const executionModel = selected?.kind === 'provider'
    ? resolveAiModelPreset(
        selected.id,
        providerModel,
        selectedProviderSettings?.baseUrl || '',
        selectedProviderModels,
      )
    : undefined;

  const createReviewer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !selected ||
      (selected.kind === 'provider' && !providerModel.trim()) ||
      (selected.kind === 'acp' && (
        consentedAcpAgentId !== selected.id || !acpConfig.isReady()
      ))
    ) return;
    draftSettings.addGlobalReviewer({
      name: name.trim(),
      tagline: translateUiText('onboarding.reviewerSetup.defaultTagline'),
      description: translateUiText('onboarding.reviewerSetup.defaultDescription'),
      // Selects the product-owned General Code Reviewer system prompt. Runtime adds immutable guardrails.
      category: 'custom',
      avatarEmoji: '🤖',
      customInstructions: '',
      ...(selected.kind === 'provider'
        ? {
            provider: selected.id,
            model: providerModel.trim(),
            ...(executionModel?.reasoningEfforts?.includes(reasoningEffort as AiReasoningEffort)
              ? { reasoningEffort }
              : {}),
            ...(executionModel?.supportsFastMode ? { fastMode } : {}),
          }
        : {
            acpAgentId: selected.id,
            ...(Object.keys(acpConfigOptions).length > 0 ? { acpConfigOptions } : {}),
            allowAcpSourceTransfer: true,
          }),
      temperature: 0.2,
      enabled: true,
      isBuiltin: false,
    });
    if (onAutoSave) {
      queueMicrotask(() => {
        void onAutoSave();
      });
    }
  };

  const loadProviderModels = async (providerId: AiProviderId | undefined) => {
    if (!providerId) return;
    const providerSettings = providerSettingsFor(draftSettings.aiConfig, providerId);
    await fetchDynamicModels({
      ...draftSettings.aiConfig,
      ...providerSettings,
      provider: providerId,
      apiKey: providerId === draftSettings.aiConfig.provider
        ? draftSettings.aiConfig.apiKey
        : '',
    });
  };

  const selectConnection = (value: string) => {
    setConnectionId(value);
    if (value.startsWith('provider:')) {
      void loadProviderModels(value.slice('provider:'.length) as AiProviderId);
    }
  };

  const loadSelectedProviderModels = () => loadProviderModels(selectedProviderId);

  if (readyReviewer) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-surface0 p-4 text-xs leading-5 text-subtext1">
        <div>
          <p className="font-semibold text-text">{translateUiText('onboarding.reviewerSetup.ready', { name: readyReviewer.name })}</p>
          <p>{translateUiText(hasSavedRequiredReviewer ? 'onboarding.reviewerSetup.saved' : 'onboarding.reviewerSetup.savingReviewer')}</p>
        </div>
        <span className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold text-white ${hasSavedRequiredReviewer ? 'bg-emerald-600' : 'bg-brand'}`}>
          {translateUiText(hasSavedRequiredReviewer ? 'onboarding.reviewerSetup.savedEnabled' : 'onboarding.reviewerSetup.saving')}
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={createReviewer} className="space-y-4 rounded-sm border border-surface0 bg-mantle/50 p-4">
      <p className="text-xs leading-5 text-subtext0">
        {translateUiText('onboarding.reviewerSetup.intro')}
      </p>
      <label className="block space-y-1.5 text-xs font-medium text-subtext1">
        <span>{translateUiText('onboarding.reviewerSetup.reviewerName')}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
          className="w-full rounded-sm border border-surface1 bg-base px-3 py-2 text-sm text-text"
        />
      </label>
      {connections.length > 0 ? (
        <label className="block space-y-1.5 text-xs font-medium text-subtext1">
          <span>{translateUiText('onboarding.reviewerSetup.aiConnection')}</span>
          <CustomSelect
            id="onboarding-reviewer-connection"
            value={selected?.value ?? ''}
            onChange={selectConnection}
            options={connectionOptions}
            className="w-full"
            buttonClassName="w-full bg-base px-3 py-2 text-sm"
            dropdownWidth="w-full"
            align="left"
            placeholder={translateUiText('common.select.placeholder')}
            aria-label={translateUiText('onboarding.reviewerSetup.aiConnection')}
          />
        </label>
      ) : (
        <p role="status" className="text-xs text-subtext0">
          {translateUiText('onboarding.reviewerSetup.addConnectionFirst')}
        </p>
      )}
      {selected?.kind === 'provider' && (
        <div className="space-y-3 rounded-sm bg-crust p-3">
          <label className="block space-y-1.5 text-xs font-medium text-subtext1">
            <span className="flex items-center justify-between gap-2">
              {translateUiText('onboarding.reviewerSetup.model')}
              <button
                type="button"
                disabled={isFetchingDynamicModels}
                onClick={() => void loadSelectedProviderModels()}
                title={translateUiText('ai.providerModel.refreshModelsTitle')}
                className="rounded-sm text-[10px] text-subtext0 hover:text-text disabled:opacity-40"
              >
                {isFetchingDynamicModels ? translateUiText('ai.providerModel.refreshing') : translateUiText('ai.providerModel.refreshModels')}
              </button>
            </span>
            <CustomSelect
              value={providerModel}
              options={modelOptions}
              onChange={(model) => {
                setProviderModel(model);
                setReasoningEffort(undefined);
                setFastMode(false);
              }}
              searchable={modelOptions.length > 8}
              searchPlaceholder={translateUiText('onboarding.reviewerSetup.searchModels')}
              disabled={isFetchingDynamicModels || modelOptions.length === 0}
              className="w-full"
              buttonClassName="w-full"
              dropdownWidth="w-full"
              align="left"
              aria-label={translateUiText('onboarding.reviewerSetup.reviewerModel')}
            />
            {dynamicModelError && <p role="alert" className="text-[10px] text-red">{dynamicModelError}</p>}
          </label>
          <AiModelExecutionOptions
            model={executionModel}
            reasoningEffort={reasoningEffort}
            fastMode={fastMode}
            onReasoningEffortChange={setReasoningEffort}
            onFastModeChange={setFastMode}
            emptyMessage={translateUiText('onboarding.reviewerSetup.modelOptionsUnavailable')}
          />
        </div>
      )}
      {selected?.kind === 'acp' && (
        <div className="space-y-3 rounded-sm bg-crust p-3">
          <AcpReviewerConfigOptions
            agent={selected.agent}
            value={acpConfigOptions}
            state={acpConfig}
          />
          <label className="flex items-start gap-2 text-xs leading-5 text-subtext1">
            <input
              type="checkbox"
              checked={consentedAcpAgentId === selected.id}
              onChange={(event) => setConsentedAcpAgentId(event.target.checked ? selected.id : null)}
              className="mt-0.5 accent-brand"
            />
            <span>
              {translateUiText('onboarding.reviewerSetup.sourceTransferConsent')}
            </span>
          </label>
        </div>
      )}
      <button
        type="submit"
        disabled={
          !name.trim() || !selected ||
          (selected.kind === 'provider' && !providerModel.trim()) ||
          (selected.kind === 'acp' && (
            consentedAcpAgentId !== selected.id || !acpConfig.ready
          ))
        }
        className="rounded-sm border-0 bg-brand px-4 py-2 text-xs font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {translateUiText('onboarding.reviewerSetup.createFirstReviewer')}
      </button>
    </form>
  );
}
