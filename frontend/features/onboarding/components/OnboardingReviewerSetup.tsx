import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { useAiMcpStore } from '../../ai/store/useAiMcpStore';
import { AcpReviewerConfigOptions } from '../../ai/components/AcpReviewerConfigOptions';
import { AiModelExecutionOptions } from '../../ai/components/AiModelExecutionOptions';
import { AI_PROVIDERS } from '../../ai/constants/aiPresets';
import { useAcpReviewerConfigOptions } from '../../ai/hooks/useAcpReviewerConfigOptions';
import type { AiReasoningEffort } from '../../ai/types/AiReasoningEffort';
import type { AcpReviewConfigOverrides } from '../../ai/types/AcpReviewConfigOverrides';
import { providerSettingsFor } from '../../ai/utils/aiProviderSettings';
import { resolveAiModelPreset } from '../../ai/utils/resolveAiModelPreset';
import type { OnboardingReviewerConnection } from '../types/OnboardingReviewerConnection';
import type { OnboardingReviewerSetupProps } from '../types/OnboardingReviewerSetupProps';

export function OnboardingReviewerSetup({
  draftSettings,
  hasSavedRequiredReviewer,
  onAutoSave,
}: OnboardingReviewerSetupProps) {
  const dynamicModels = useAiMcpStore((state) => state.dynamicModels);
  const [name, setName] = useState('Code Reviewer');
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
    model: providerSettingsFor(draftSettings.aiConfig, provider.id).model.trim() || 'global_default',
  }));
  const agents = draftSettings.externalAgents
    .filter((agent) => agent.id.trim() && agent.command.trim())
    .map((agent) => ({ id: agent.id, value: `acp:${agent.id}`, kind: 'acp' as const, label: `${agent.name} (ACP)`, agent }));
  const connections: OnboardingReviewerConnection[] = [...providers, ...agents];
  const activeProvider = providers.find((provider) => provider.id === draftSettings.aiConfig.provider);
  const selected = connections.find((connection) => connection.value === connectionId) ?? activeProvider ?? connections[0];
  const selectedProviderId = selected?.kind === 'provider' ? selected.id : undefined;
  const selectedProviderSettings = useMemo(
    () => selectedProviderId ? providerSettingsFor(draftSettings.aiConfig, selectedProviderId) : undefined,
    [draftSettings.aiConfig, selectedProviderId],
  );
  const selectedProviderModels = selectedProviderId ? dynamicModels[selectedProviderId] : undefined;
  const selectedProviderPreset = selectedProviderId
    ? AI_PROVIDERS.find((provider) => provider.id === selectedProviderId)
    : undefined;
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
    if (selectedProviderId && selectedProviderSettings) {
      const settings = selectedProviderSettings;
      const model = settings.model.trim() && settings.model !== 'global_default'
        ? settings.model.trim()
        : AI_PROVIDERS.find((provider) => provider.id === selectedProviderId)?.defaultModel || '';
      const capabilities = resolveAiModelPreset(
        selectedProviderId,
        model,
        settings.baseUrl,
        selectedProviderModels || [],
      );
      setProviderModel(model);
      setReasoningEffort(
        capabilities?.reasoningEfforts?.includes(settings.reasoningEffort as AiReasoningEffort)
          ? settings.reasoningEffort
          : undefined,
      );
      setFastMode(capabilities?.supportsFastMode === true && settings.fastMode === true);
    } else {
      setProviderModel('');
      setReasoningEffort(undefined);
      setFastMode(false);
    }
    setAcpConfigOptions({});
  }, [selected?.value, selectedProviderId, selectedProviderSettings, selectedProviderModels]);

  const providerModelCatalog = selected?.kind === 'provider'
    ? [
        ...(dynamicModels[selected.id] || []),
        ...(selectedProviderPreset?.models || []),
      ]
    : [];
  const uniqueModels = [...new Map(providerModelCatalog.map((model) => [model.id, model])).values()];
  if (providerModel && !uniqueModels.some((model) => model.id === providerModel)) {
    uniqueModels.unshift({ id: providerModel, name: providerModel });
  }
  const modelOptions: CustomSelectOption<string>[] = uniqueModels.map((model) => ({
    value: model.id,
    label: model.name || model.id,
    description: model.recommendedFor || model.id,
  }));
  const executionModel = selected?.kind === 'provider'
    ? resolveAiModelPreset(
        selected.id,
        providerModel,
        selectedProviderSettings?.baseUrl || '',
        dynamicModels[selected.id] || [],
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
      tagline: 'Code review',
      description: 'Checks code changes for correctness, reliability, and maintainability.',
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

  if (readyReviewer) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-surface0 p-4 text-xs leading-5 text-subtext1">
        <div>
          <p className="font-semibold text-text">{readyReviewer.name} is ready.</p>
          <p>{hasSavedRequiredReviewer ? 'Your first reviewer is saved.' : 'Saving your first reviewer…'}</p>
        </div>
        <span className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold text-white ${hasSavedRequiredReviewer ? 'bg-emerald-600' : 'bg-brand'}`}>
          {hasSavedRequiredReviewer ? 'Saved & Enabled' : 'Saving…'}
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={createReviewer} className="space-y-4 rounded-sm border border-surface0 bg-mantle/50 p-4">
      <p className="text-xs leading-5 text-subtext0">
        Start with a general code reviewer. You can fine-tune its role and instructions later in AI Preferences.
      </p>
      <label className="block space-y-1.5 text-xs font-medium text-subtext1">
        <span>Reviewer name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
          className="w-full rounded-sm border border-surface1 bg-base px-3 py-2 text-sm text-text"
        />
      </label>
      {connections.length > 1 ? (
        <label className="block space-y-1.5 text-xs font-medium text-subtext1">
          <span>AI connection</span>
          <select
            value={selected?.value ?? ''}
            onChange={(event) => setConnectionId(event.target.value)}
            className="w-full rounded-sm border border-surface1 bg-base px-3 py-2 text-sm text-text"
          >
            {connections.map((connection) => (
              <option key={connection.value} value={connection.value}>
                {connection.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        selected && <p className="text-xs text-subtext0">Uses {selected.label}.</p>
      )}
      {!selected ? (
        <p role="status" className="text-xs text-subtext0">
          Add an AI connection in the previous step to continue.
        </p>
      ) : null}
      {selected?.kind === 'provider' && (
        <div className="space-y-3 rounded-sm bg-crust p-3">
          <label className="block space-y-1.5 text-xs font-medium text-subtext1">
            <span>Model</span>
            <CustomSelect
              value={providerModel}
              options={modelOptions}
              onChange={(model) => {
                setProviderModel(model);
                const capabilities = resolveAiModelPreset(
                  selected.id,
                  model,
                  selectedProviderSettings?.baseUrl || '',
                  dynamicModels[selected.id] || [],
                );
                const providerDefaults = providerSettingsFor(draftSettings.aiConfig, selected.id);
                setReasoningEffort(
                  model === providerDefaults.model && capabilities?.reasoningEfforts?.includes(
                    providerDefaults.reasoningEffort as AiReasoningEffort
                  )
                    ? providerDefaults.reasoningEffort
                    : undefined,
                );
                setFastMode(model === providerDefaults.model && capabilities?.supportsFastMode === true && providerDefaults.fastMode === true);
              }}
              searchable={modelOptions.length > 8}
              searchPlaceholder="Search models…"
              className="w-full"
              buttonClassName="w-full"
              dropdownWidth="w-full"
              align="left"
              aria-label="Reviewer model"
            />
          </label>
          <AiModelExecutionOptions
            model={executionModel}
            reasoningEffort={reasoningEffort}
            fastMode={fastMode}
            onReasoningEffortChange={setReasoningEffort}
            onFastModeChange={setFastMode}
            emptyMessage="Reasoning and Fast mode controls are unavailable for this model."
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
              I allow this agent to receive eligible changed-file diffs and review context. Sensitive paths are excluded and matching secret lines are redacted, but detection may miss some secrets.
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
        Create first reviewer
      </button>
    </form>
  );
}
