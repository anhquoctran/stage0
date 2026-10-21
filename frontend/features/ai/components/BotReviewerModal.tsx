import React from 'react';
import { Bot } from '../../../common/components/icons/Bot';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { AiModelExecutionOptions } from './AiModelExecutionOptions';
import { AcpReviewerConfigOptions } from './AcpReviewerConfigOptions';
import { AI_PROVIDERS } from '../constants/aiPresets';
import { BOT_CATEGORIES } from '../constants/botPresets';
import { getBotRolePrompt } from '../utils/botRolePrompts';
import { resolveAiModelPreset } from '../utils/resolveAiModelPreset';
import {
  EMOJI_PRESETS,
  CUSTOM_MODEL_OPTION,
  BOT_CATEGORY_OPTIONS,
  BOT_PROVIDER_OPTIONS,
  BOT_EXECUTION_OPTIONS,
} from '../constants/botReviewerConstants';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';
import type { AiReasoningEffort } from '../types/AiReasoningEffort';
import type { AcpReviewConfigOverrides } from '../types/AcpReviewConfigOverrides';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';
import type { AiConfig } from '../types/AiConfig';
import type { AiProviderPreset } from '../types/AiProviderPreset';
import type { AiModelPreset } from '../types/AiModelPreset';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';

export const BotReviewerModal: React.FC<{
  isOpen: boolean;
  editingBotId: string | null;
  formName: string;
  setFormName: (val: string) => void;
  formTagline: string;
  setFormTagline: (val: string) => void;
  formDesc: string;
  setFormDesc: (val: string) => void;
  formCategory: BotCategory;
  setFormCategory: (val: BotCategory) => void;
  formEmoji: string;
  setFormEmoji: (val: string) => void;
  formInstructions: string;
  setFormInstructions: (val: string) => void;
  formExecutionMode: 'provider' | 'acp';
  setFormExecutionMode: (val: 'provider' | 'acp') => void;
  formAcpAgentId: string;
  setFormAcpAgentId: (val: string) => void;
  formAllowAcpSourceTransfer: boolean;
  setFormAllowAcpSourceTransfer: (val: boolean) => void;
  formAcpConfigOptions: AcpReviewConfigOverrides;
  setFormAcpConfigOptions: React.Dispatch<React.SetStateAction<AcpReviewConfigOverrides>>;
  formProvider: string;
  setFormProvider: (val: string) => void;
  formModel: string;
  setFormModel: (val: string) => void;
  isCustomModel: boolean;
  setIsCustomModel: (val: boolean) => void;
  formTemp: number;
  setFormTemp: (val: number) => void;
  formReasoningEffort: AiReasoningEffort | undefined;
  setFormReasoningEffort: (val: AiReasoningEffort | undefined) => void;
  formFastMode: boolean;
  setFormFastMode: (val: boolean) => void;
  formError: string | null;
  externalAgents: AcpAgentConfig[];
  globalAiConfig: AiConfig;
  providerPreset: AiProviderPreset | undefined;
  effectiveProvider: string;
  inheritsGlobalModel: boolean;
  availableModels: AiModelPreset[];
  executionModel: AiModelPreset | undefined;
  executionBaseUrl: string;
  dynamicModels: Record<string, AiModelPreset[]>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}> = ({
  isOpen,
  editingBotId,
  formName,
  setFormName,
  formTagline,
  setFormTagline,
  formDesc,
  setFormDesc,
  formCategory,
  setFormCategory,
  formEmoji,
  setFormEmoji,
  formInstructions,
  setFormInstructions,
  formExecutionMode,
  setFormExecutionMode,
  formAcpAgentId,
  setFormAcpAgentId,
  formAllowAcpSourceTransfer,
  setFormAllowAcpSourceTransfer,
  formAcpConfigOptions,
  setFormAcpConfigOptions,
  formProvider,
  setFormProvider,
  formModel,
  setFormModel,
  isCustomModel,
  setIsCustomModel,
  formTemp,
  setFormTemp,
  formReasoningEffort,
  setFormReasoningEffort,
  formFastMode,
  setFormFastMode,
  formError,
  externalAgents,
  globalAiConfig,
  providerPreset,
  effectiveProvider,
  inheritsGlobalModel,
  availableModels,
  executionModel,
  executionBaseUrl,
  dynamicModels,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const modelOptions: CustomSelectOption<string>[] = [
    ...(formProvider === 'global_default' || formModel === 'global_default'
      ? [{
          value: 'global_default',
          label: formProvider === 'global_default'
            ? `Use global model (${globalAiConfig.model})`
            : `Use provider default (${providerPreset?.defaultModel || globalAiConfig.model})`,
          description: formProvider === 'global_default'
            ? 'Inherit the model configured in LLM Providers.'
            : 'Use the selected provider’s default model.',
        }]
      : []),
    ...availableModels.map((model) => ({ value: model.id, label: model.name || model.id, description: model.id })),
    ...(!isCustomModel && formModel && formModel !== 'global_default' && !availableModels.some((model) => model.id === formModel)
      ? [{ value: formModel, label: `${formModel} (Saved custom model)` }]
      : []),
    { value: CUSTOM_MODEL_OPTION, label: 'Custom model…', description: 'Enter an ID for a model not listed above.' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-mantle border border-surface0 w-full max-w-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-surface0 pb-3">
          <h4 className="text-sm font-bold text-text flex items-center gap-2">
            <Bot className="w-4 h-4 text-brand" />
            {editingBotId ? 'Edit Reviewer Bot' : 'Create Custom Reviewer Bot'}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-subtext0 hover:text-text cursor-pointer"
          >
            ✕
          </button>
        </div>

        {formError && (
          <div className="p-2.5 bg-red/10 border border-red/20 text-red text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">
                Avatar Emoji
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  maxLength={4}
                  value={formEmoji}
                  onChange={(e) => setFormEmoji(e.target.value)}
                  className="w-12 h-9 text-center text-lg bg-surface0 border border-surface1 text-text focus:outline-none focus:border-brand"
                />
                <div className="flex gap-1 flex-wrap max-w-[80px]">
                  {EMOJI_PRESETS.slice(0, 6).map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setFormEmoji(em)}
                      className="hover:scale-125 transition-transform text-xs cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-span-3">
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">
                Bot Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Accessibility Auditor"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface0 border border-surface1 text-xs text-text focus:outline-none focus:border-brand"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">
                Tagline
              </label>
              <input
                type="text"
                placeholder="e.g. WCAG 2.1 & Screen Reader Compliance"
                value={formTagline}
                onChange={(e) => setFormTagline(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface0 border border-surface1 text-xs text-text focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">
                Role
              </label>
              <CustomSelect
                value={formCategory}
                options={BOT_CATEGORY_OPTIONS}
                onChange={setFormCategory}
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label="Bot role"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-subtext0 mb-1">
              Description
            </label>
            <input
              type="text"
              placeholder="Short explanation of what this bot checks in code reviews..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface0 border border-surface1 text-xs text-text focus:outline-none focus:border-brand"
            />
          </div>

          {/* Stage0 managed role prompt and user additions */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold text-subtext0">
                Stage0 System Prompt · {BOT_CATEGORIES.find((category) => category.id === formCategory)?.label}
              </label>
              <span className="text-[10px] text-subtext0 font-mono">Read-only · selected by role</span>
            </div>
            <pre className="w-full max-h-36 overflow-y-auto whitespace-pre-wrap px-3 py-2 bg-crust border border-surface1 text-xs font-mono text-subtext1 leading-relaxed select-text">
              {getBotRolePrompt(formCategory)}
            </pre>
            <label className="block text-[11px] font-semibold text-subtext0 mt-3 mb-1">
              Additional Instructions <span className="font-normal">(optional)</span>
            </label>
            <textarea
              rows={5}
              value={formInstructions}
              onChange={(e) => setFormInstructions(e.target.value)}
              placeholder="Add bot-specific review guidance. This is combined with the read-only Stage0 role prompt."
              className="w-full px-3 py-2 bg-surface0 border border-surface1 text-xs font-mono text-text focus:outline-none focus:border-brand leading-relaxed"
            />
          </div>

          {/* Model & Execution Parameters */}
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
                          if (formModel === 'global_default' || availableModels.some((item) => item.id === formModel)) setFormModel('');
                          setFormReasoningEffort(undefined);
                          setFormFastMode(false);
                        } else {
                          setIsCustomModel(false);
                          setFormModel(model);
                          const nextModelId = model === 'global_default'
                            ? formProvider === 'global_default' ? globalAiConfig.model : providerPreset?.defaultModel || ''
                            : model;
                          const nextModel = resolveAiModelPreset(
                            effectiveProvider,
                            nextModelId,
                            executionBaseUrl,
                            dynamicModels[effectiveProvider as keyof typeof dynamicModels] || [],
                          );
                          if (!nextModel?.reasoningEfforts?.includes(formReasoningEffort as AiReasoningEffort)) {
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
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-subtext0">Reasoning &amp; processing</span>
                  {inheritsGlobalModel ? (
                    <p className="text-[10px] text-subtext0">Uses the global model and its reasoning and Fast mode settings.</p>
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
                    I allow this ACP agent to receive eligible changed-file diffs and review context. Sensitive paths are excluded and matching secret lines are redacted, but detection cannot catch every secret. This consent is used for automatic reviews assigned to this bot.
                  </span>
                </label>
                <p className="text-[10px] text-subtext0">
                  Stage0 still validates tool requests, finding evidence, and changed-line coordinates. The agent runs outside the repository directory; its own runtime and policies are managed by its publisher.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-surface0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-surface0 hover:bg-surface1 text-text text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs transition-colors cursor-pointer shadow-xs"
            >
              {editingBotId ? 'Update Bot' : 'Create Bot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
