import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { Bot } from '../../../common/components/icons/Bot';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import {
  BOT_CATEGORY_OPTIONS,
  CUSTOM_MODEL_OPTION,
  EMOJI_PRESETS,
} from '../constants/botReviewerConstants';
import type { BotReviewerModalProps } from './BotReviewerModalProps';
import { BotExecutionModelForm } from './reviewer-bot/BotExecutionModelForm';
import { BotPromptConfigForm } from './reviewer-bot/BotPromptConfigForm';

export const BotReviewerModal: React.FC<BotReviewerModalProps> = ({
  dialog: { isOpen, canSubmit, editingBotId, formError, onClose, onSubmit },
  identity: {
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
  },
  execution: {
    acpConfig,
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
  },
  catalog: {
    externalAgents,
    globalAiConfig,
    providerPreset,
    effectiveProvider,
    inheritsGlobalModel,
    availableModels,
    executionModel,
    executionBaseUrl,
    dynamicModels,
  },
}) => {
  const { t: translateUiText } = useUiTextTranslation();
  if (!isOpen) return null;

  const modelOptions: CustomSelectOption<string>[] = [
    ...(formProvider === 'global_default' || formModel === 'global_default'
      ? [
          {
            value: 'global_default',
            label:
              formProvider === 'global_default'
                ? translateUiText('ai.reviewerBot.useGlobalModel', { model: globalAiConfig.model })
                : translateUiText('ai.reviewerBot.useProviderDefault', { model: providerPreset?.defaultModel || globalAiConfig.model }),
            description:
              formProvider === 'global_default'
                ? translateUiText('ai.reviewerBot.inheritProviderModel')
                : translateUiText('ai.reviewerBot.useSelectedProviderDefault'),
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
      ? [{ value: formModel, label: translateUiText('ai.reviewerBot.savedCustomModel', { model: formModel }) }]
      : []),
    {
      value: CUSTOM_MODEL_OPTION,
      label: translateUiText('ai.reviewerBot.customModel'),
      description: translateUiText('ai.reviewerBot.enterUnlistedModel'),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-mantle border border-surface0 w-full max-w-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto rounded-sm">
        <div className="flex items-center justify-between border-b border-surface0 pb-3">
          <h4 className="text-sm font-bold text-text flex items-center gap-2">
            <Bot className="w-4 h-4 text-brand" />
            {editingBotId ? translateUiText('ai.reviewerBot.editTitle') : translateUiText('ai.reviewerBot.createTitle')}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-subtext0 hover:text-text cursor-pointer rounded-sm"
          >
            ✕
          </button>
        </div>

        {formError && (
          <div className="p-2.5 bg-red/10 border border-red/20 text-red text-xs flex items-center gap-2 rounded-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1">
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">
                {translateUiText('ai.reviewerBot.avatarEmoji')}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  maxLength={4}
                  value={formEmoji}
                  onChange={(e) => setFormEmoji(e.target.value)}
                  className="w-12 h-9 text-center text-lg bg-surface0 border border-surface1 text-text focus:outline-none focus:border-brand rounded-sm"
                />
                <div className="flex gap-1 flex-wrap max-w-[80px]">
                  {EMOJI_PRESETS.slice(0, 6).map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setFormEmoji(em)}
                      className="hover:scale-125 transition-transform text-xs cursor-pointer rounded-sm"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-span-3">
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">
                {translateUiText('ai.reviewerBot.nameRequired')}
              </label>
              <input
                type="text"
                required
                placeholder={translateUiText('ai.reviewerBot.namePlaceholder')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface0 border border-surface1 text-xs text-text focus:outline-none focus:border-brand rounded-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">{translateUiText('ai.reviewerBot.tagline')}</label>
              <input
                type="text"
                placeholder={translateUiText('ai.reviewerBot.taglinePlaceholder')}
                value={formTagline}
                onChange={(e) => setFormTagline(e.target.value)}
                className="w-full px-3 py-1.5 bg-surface0 border border-surface1 text-xs text-text focus:outline-none focus:border-brand rounded-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-subtext0 mb-1">{translateUiText('ai.reviewerBot.role')}</label>
              <CustomSelect
                value={formCategory}
                options={BOT_CATEGORY_OPTIONS}
                onChange={setFormCategory}
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label={translateUiText('ai.reviewerBot.role')}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-subtext0 mb-1">
              {translateUiText('ai.reviewerBot.description')}
            </label>
            <input
              type="text"
              placeholder={translateUiText('ai.reviewerBot.descriptionPlaceholder')}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="w-full px-3 py-1.5 bg-surface0 border border-surface1 text-xs text-text focus:outline-none focus:border-brand rounded-sm"
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
            execution={{
              formExecutionMode: formExecutionMode,
              setFormExecutionMode: setFormExecutionMode,
              setFormReasoningEffort: setFormReasoningEffort,
              setFormFastMode: setFormFastMode,
              formProvider: formProvider,
              setFormProvider: setFormProvider,
              setIsCustomModel: setIsCustomModel,
              setFormModel: setFormModel,
              isCustomModel: isCustomModel,
              formModel: formModel,
              formReasoningEffort: formReasoningEffort,
              formTemp: formTemp,
              setFormTemp: setFormTemp,
              formFastMode: formFastMode,
            }}
            catalog={{
              modelOptions: modelOptions,
              availableModels: availableModels,
              globalAiConfig: globalAiConfig,
              providerPreset: providerPreset,
              effectiveProvider: effectiveProvider,
              executionBaseUrl: executionBaseUrl,
              dynamicModels: dynamicModels,
              inheritsGlobalModel: inheritsGlobalModel,
              executionModel: executionModel,
            }}
            acp={{
              acpConfig,
              externalAgents: externalAgents,
              formAcpAgentId: formAcpAgentId,
              setFormAcpAgentId: setFormAcpAgentId,
              setFormAcpConfigOptions: setFormAcpConfigOptions,
              formAcpConfigOptions: formAcpConfigOptions,
              formAllowAcpSourceTransfer: formAllowAcpSourceTransfer,
              setFormAllowAcpSourceTransfer: setFormAllowAcpSourceTransfer,
            }}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-surface0 rounded-sm">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-surface0 hover:bg-surface1 text-text text-xs transition-colors cursor-pointer rounded-sm"
            >
              {translateUiText('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-5 py-1.5 border-0 bg-brand enabled:hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed text-on-accent font-semibold text-xs transition-colors cursor-pointer shadow-xs rounded-sm"
            >
              {editingBotId ? translateUiText('ai.reviewerBot.updateButton') : translateUiText('ai.reviewerBot.createButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
