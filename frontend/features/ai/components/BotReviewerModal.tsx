import React from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { Bot } from '../../../common/components/icons/Bot';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';
import {
  BOT_CATEGORY_OPTIONS,
  CUSTOM_MODEL_OPTION,
  EMOJI_PRESETS,
} from '../constants/botReviewerConstants';
import type { AcpAgentConfig } from '../types/AcpAgentConfig';
import type { AcpReviewConfigOverrides } from '../types/AcpReviewConfigOverrides';
import type { AiConfig } from '../types/AiConfig';
import type { AiModelPreset } from '../types/AiModelPreset';
import type { AiProviderPreset } from '../types/AiProviderPreset';
import type { AiReasoningEffort } from '../types/AiReasoningEffort';
import { BotExecutionModelForm } from './reviewer-bot/BotExecutionModelForm';
import { BotPromptConfigForm } from './reviewer-bot/BotPromptConfigForm';

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
      ? [
          {
            value: 'global_default',
            label:
              formProvider === 'global_default'
                ? `Use global model (${globalAiConfig.model})`
                : `Use provider default (${providerPreset?.defaultModel || globalAiConfig.model})`,
            description:
              formProvider === 'global_default'
                ? 'Inherit the model configured in LLM Providers.'
                : 'Use the selected provider’s default model.',
          },
        ]
      : []),
    ...availableModels.map((model) => ({
      value: model.id,
      label: model.name || model.id,
      description: model.id,
    })),
    ...(!isCustomModel &&
    formModel &&
    formModel !== 'global_default' &&
    !availableModels.some((model) => model.id === formModel)
      ? [{ value: formModel, label: `${formModel} (Saved custom model)` }]
      : []),
    {
      value: CUSTOM_MODEL_OPTION,
      label: 'Custom model…',
      description: 'Enter an ID for a model not listed above.',
    },
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
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">Tagline</label>
              <input
                type="text"
                placeholder="e.g. WCAG 2.1 & Screen Reader Compliance"
                value={formTagline}
                onChange={(e) => setFormTagline(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface0 border border-surface1 text-xs text-text focus:outline-none focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">Role</label>
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
          <BotPromptConfigForm
            formCategory={formCategory}
            formInstructions={formInstructions}
            setFormInstructions={setFormInstructions}
          />

          {/* Model & Execution Parameters */}
          <BotExecutionModelForm
            formExecutionMode={formExecutionMode}
            setFormExecutionMode={setFormExecutionMode}
            setFormReasoningEffort={setFormReasoningEffort}
            setFormFastMode={setFormFastMode}
            formProvider={formProvider}
            setFormProvider={setFormProvider}
            setIsCustomModel={setIsCustomModel}
            setFormModel={setFormModel}
            isCustomModel={isCustomModel}
            formModel={formModel}
            modelOptions={modelOptions}
            availableModels={availableModels}
            globalAiConfig={globalAiConfig}
            providerPreset={providerPreset}
            effectiveProvider={effectiveProvider}
            executionBaseUrl={executionBaseUrl}
            dynamicModels={dynamicModels}
            formReasoningEffort={formReasoningEffort}
            formTemp={formTemp}
            setFormTemp={setFormTemp}
            parseFloat={parseFloat}
            inheritsGlobalModel={inheritsGlobalModel}
            executionModel={executionModel}
            formFastMode={formFastMode}
            externalAgents={externalAgents}
            formAcpAgentId={formAcpAgentId}
            setFormAcpAgentId={setFormAcpAgentId}
            setFormAcpConfigOptions={setFormAcpConfigOptions}
            formAcpConfigOptions={formAcpConfigOptions}
            formAllowAcpSourceTransfer={formAllowAcpSourceTransfer}
            setFormAllowAcpSourceTransfer={setFormAllowAcpSourceTransfer}
          />

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
