import { CustomSelect } from '../../../../common/components/CustomSelect';
import { AI_PROVIDERS } from '../../constants/aiPresets';
import {
  BOT_EXECUTION_OPTIONS,
  BOT_PROVIDER_OPTIONS,
  CUSTOM_MODEL_OPTION,
} from '../../constants/botReviewerConstants';
import type { AiReasoningEffort } from '../../types/AiReasoningEffort';
import { resolveAiModelPreset } from '../../utils/resolveAiModelPreset';
import { AcpReviewerConfigOptions } from '../AcpReviewerConfigOptions';
import { AiModelExecutionOptions } from '../AiModelExecutionOptions';
import type { BotExecutionModelFormProps } from './BotExecutionModelFormProps';

export function BotExecutionModelForm({
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
  modelOptions,
  availableModels,
  globalAiConfig,
  providerPreset,
  effectiveProvider,
  executionBaseUrl,
  dynamicModels,
  formReasoningEffort,
  formTemp,
  setFormTemp,
  parseFloat,
  inheritsGlobalModel,
  executionModel,
  formFastMode,
  externalAgents,
  formAcpAgentId,
  setFormAcpAgentId,
  setFormAcpConfigOptions,
  formAcpConfigOptions,
  formAllowAcpSourceTransfer,
  setFormAllowAcpSourceTransfer,
}: BotExecutionModelFormProps) {
  return (
    <div className="p-3 bg-surface0/30 border border-surface0 space-y-3">
      <span className="text-[11px] font-bold text-text uppercase tracking-wider block">
        Execution &amp; Model
      </span>
      <div>
        <label className="block text-[10px] text-subtext0 mb-1">Execution engine</label>
        <CustomSelect
          value={formExecutionMode}
          options={BOT_EXECUTION_OPTIONS}
          onChange={(mode) => {
            setFormExecutionMode(mode);
            setFormReasoningEffort(undefined);
            setFormFastMode(false);
          }}
          className="w-full"
          buttonClassName="w-full"
          dropdownWidth="w-full"
          align="left"
          aria-label="Execution engine"
        />
      </div>
      {formExecutionMode === 'provider' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-subtext0 mb-1">LLM Provider</label>
              <CustomSelect
                value={formProvider}
                options={BOT_PROVIDER_OPTIONS}
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
                aria-label="Provider override"
              />
            </div>

            <div>
              <label className="block text-[10px] text-subtext0 mb-1">Model</label>
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
                searchPlaceholder="Search models…"
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label="Model override"
              />
              {isCustomModel && (
                <input
                  type="text"
                  aria-label="Custom model ID"
                  required
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value)}
                  placeholder="Enter custom model ID"
                  className="mt-2 w-full px-2 py-1.5 bg-surface0 border border-surface1 text-xs text-text focus:outline-none focus:border-brand font-mono"
                />
              )}
            </div>

            <div>
              <label className="block text-[10px] text-subtext0 mb-1">
                Temperature ({formTemp})
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={formTemp}
                onChange={(e) => setFormTemp(parseFloat(e.target.value))}
                className="w-full mt-2 cursor-pointer"
              />
            </div>
          </div>
          <div className="pt-2 border-t border-surface0/70 space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">
              Reasoning &amp; processing
            </span>
            {inheritsGlobalModel ? (
              <p className="text-[10px] text-subtext0">
                Uses the global model and its reasoning and Fast mode settings.
              </p>
            ) : (
              <AiModelExecutionOptions
                model={executionModel}
                reasoningEffort={formReasoningEffort}
                fastMode={formFastMode}
                onReasoningEffortChange={setFormReasoningEffort}
                onFastModeChange={setFormFastMode}
                emptyMessage="Stage0 has no declared reasoning or Fast mode capabilities for this provider and model."
              />
            )}
          </div>
        </>
      ) : (
        <div className="space-y-3 border border-surface0 bg-crust/50 p-3">
          <div>
            <label className="block text-[10px] text-subtext0 mb-1">Installed ACP agent</label>
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
                searchPlaceholder="Search installed agents…"
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label="ACP reviewer agent"
              />
            ) : (
              <p className="border border-yellow/40 bg-yellow/5 p-2 text-[10px] text-yellow">
                No ACP agents are installed. Add one in AI Preferences → External Agents.
              </p>
            )}
          </div>
          <AcpReviewerConfigOptions
            agent={externalAgents.find((agent) => agent.id === formAcpAgentId)}
            value={formAcpConfigOptions}
            onChange={setFormAcpConfigOptions}
          />
          <label className="flex items-start gap-2 text-[10px] text-subtext0">
            <input
              type="checkbox"
              checked={formAllowAcpSourceTransfer}
              onChange={(event) => setFormAllowAcpSourceTransfer(event.target.checked)}
              className="mt-0.5 accent-brand"
            />
            <span>
              I allow this ACP agent to receive eligible changed-file diffs and review context.
              Sensitive paths are excluded and matching secret lines are redacted, but detection
              cannot catch every secret. This consent is used for automatic reviews assigned to this
              bot.
            </span>
          </label>
          <p className="text-[10px] text-subtext0">
            Stage0 still validates tool requests, finding evidence, and changed-line coordinates.
            The agent runs outside the repository directory; its own runtime and policies are
            managed by its publisher.
          </p>
        </div>
      )}
    </div>
  );
}
