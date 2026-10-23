import React, { useMemo, useState, type SetStateAction } from 'react';
import { useFormDraft } from '../../../common/hooks/useFormDraft';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import type { AiReasoningEffort } from '../types/AiReasoningEffort';
import type { ReviewerBotDraft } from '../types/ReviewerBotDraft';
import type { ReviewerBotFormContext } from './ReviewerBotFormContext';
import { useReviewerModelCatalog } from './useReviewerModelCatalog';

export function useReviewerBotForm({
  globalAiConfig,
  dynamicModels,
  externalAgents,
  updateGlobalReviewer,
  addGlobalReviewer,
}: ReviewerBotFormContext) {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [editingBotId, setEditingBotId] = useState<string | null>(null);

  const { value: formDraft, setField } = useFormDraft<ReviewerBotDraft>(() => ({
    formName: '',
    formTagline: '',
    formDesc: '',
    formCategory: 'custom',
    formEmoji: '🤖',
    formInstructions: '',
    formExecutionMode: 'provider',
    formAcpAgentId: '',
    formAllowAcpSourceTransfer: false,
    formAcpConfigOptions: {},
    formProvider: 'global_default',
    formModel: 'global_default',
    isCustomModel: false,
    formTemp: 0.2,
    formReasoningEffort: undefined,
    formFastMode: false,
  }));
  const {
    formName,
    formTagline,
    formDesc,
    formCategory,
    formEmoji,
    formInstructions,
    formExecutionMode,
    formAcpAgentId,
    formAllowAcpSourceTransfer,
    formAcpConfigOptions,
    formProvider,
    formModel,
    isCustomModel,
    formTemp,
    formReasoningEffort,
    formFastMode,
  } = formDraft;
  const {
    setFormName,
    setFormTagline,
    setFormDesc,
    setFormCategory,
    setFormEmoji,
    setFormInstructions,
    setFormExecutionMode,
    setFormAcpAgentId,
    setFormAllowAcpSourceTransfer,
    setFormAcpConfigOptions,
    setFormProvider,
    setFormModel,
    setIsCustomModel,
    setFormTemp,
    setFormReasoningEffort,
    setFormFastMode,
  } = useMemo(
    () => ({
      setFormName: (next: SetStateAction<ReviewerBotDraft['formName']>) =>
        setField('formName', next),
      setFormTagline: (next: SetStateAction<ReviewerBotDraft['formTagline']>) =>
        setField('formTagline', next),
      setFormDesc: (next: SetStateAction<ReviewerBotDraft['formDesc']>) =>
        setField('formDesc', next),
      setFormCategory: (next: SetStateAction<ReviewerBotDraft['formCategory']>) =>
        setField('formCategory', next),
      setFormEmoji: (next: SetStateAction<ReviewerBotDraft['formEmoji']>) =>
        setField('formEmoji', next),
      setFormInstructions: (next: SetStateAction<ReviewerBotDraft['formInstructions']>) =>
        setField('formInstructions', next),
      setFormExecutionMode: (next: SetStateAction<ReviewerBotDraft['formExecutionMode']>) =>
        setField('formExecutionMode', next),
      setFormAcpAgentId: (next: SetStateAction<ReviewerBotDraft['formAcpAgentId']>) =>
        setField('formAcpAgentId', next),
      setFormAllowAcpSourceTransfer: (
        next: SetStateAction<ReviewerBotDraft['formAllowAcpSourceTransfer']>
      ) => setField('formAllowAcpSourceTransfer', next),
      setFormAcpConfigOptions: (next: SetStateAction<ReviewerBotDraft['formAcpConfigOptions']>) =>
        setField('formAcpConfigOptions', next),
      setFormProvider: (next: SetStateAction<ReviewerBotDraft['formProvider']>) =>
        setField('formProvider', next),
      setFormModel: (next: SetStateAction<ReviewerBotDraft['formModel']>) =>
        setField('formModel', next),
      setIsCustomModel: (next: SetStateAction<ReviewerBotDraft['isCustomModel']>) =>
        setField('isCustomModel', next),
      setFormTemp: (next: SetStateAction<ReviewerBotDraft['formTemp']>) =>
        setField('formTemp', next),
      setFormReasoningEffort: (next: SetStateAction<ReviewerBotDraft['formReasoningEffort']>) =>
        setField('formReasoningEffort', next),
      setFormFastMode: (next: SetStateAction<ReviewerBotDraft['formFastMode']>) =>
        setField('formFastMode', next),
    }),
    [setField]
  );

  const [formError, setFormError] = useState<string | null>(null);

  const {
    inheritsGlobalModel,
    executionModel,
    providerPreset,
    effectiveProvider,
    availableModels,
    executionBaseUrl,
  } = useReviewerModelCatalog({ formProvider, globalAiConfig, formModel, dynamicModels });

  const handleOpenAdd = () => {
    setEditingBotId(null);
    setFormName('');
    setFormTagline('');
    setFormDesc('');
    setFormCategory('custom');
    setFormEmoji('🤖');
    setFormInstructions('');
    setFormExecutionMode('provider');
    setFormAcpAgentId(externalAgents[0]?.id || '');
    setFormAllowAcpSourceTransfer(false);
    setFormAcpConfigOptions({});
    setFormProvider('global_default');
    setFormModel('global_default');
    setIsCustomModel(false);
    setFormTemp(0.2);
    setFormReasoningEffort(undefined);
    setFormFastMode(false);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (bot: BotReviewer) => {
    setEditingBotId(bot.id);
    setFormName(bot.name);
    setFormTagline(bot.tagline || '');
    setFormDesc(bot.description || '');
    setFormCategory(bot.category);
    setFormEmoji(bot.avatarEmoji);
    setFormInstructions(bot.customInstructions || '');
    setFormExecutionMode(bot.acpAgentId ? 'acp' : 'provider');
    setFormAcpAgentId(bot.acpAgentId || externalAgents[0]?.id || '');
    setFormAllowAcpSourceTransfer(bot.allowAcpSourceTransfer === true);
    setFormAcpConfigOptions(bot.acpConfigOptions || {});
    setFormProvider(bot.provider || 'global_default');
    setFormModel(bot.model || 'global_default');
    setIsCustomModel(false);
    setFormTemp(bot.temperature ?? 0.2);
    setFormReasoningEffort(bot.reasoningEffort);
    setFormFastMode(bot.fastMode === true);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Bot name is required');
      return;
    }
    if (formExecutionMode === 'provider' && !formModel.trim()) {
      setFormError('Select a model or enter a custom model ID');
      return;
    }

    const savedReasoningEffort = inheritsGlobalModel
      ? undefined
      : executionModel?.reasoningEfforts?.includes(formReasoningEffort as AiReasoningEffort)
        ? formReasoningEffort
        : undefined;
    const savedFastMode = inheritsGlobalModel
      ? undefined
      : executionModel?.supportsFastMode
        ? formFastMode
        : undefined;

    const updates = {
      name: formName.trim(),
      tagline: formTagline.trim(),
      description: formDesc.trim(),
      category: formCategory,
      avatarEmoji: formEmoji,
      customInstructions: formInstructions.trim(),
      provider: formExecutionMode === 'provider' ? formProvider : undefined,
      model: formExecutionMode === 'provider' ? formModel.trim() : undefined,
      acpAgentId: formExecutionMode === 'acp' ? formAcpAgentId : undefined,
      allowAcpSourceTransfer: formExecutionMode === 'acp' ? formAllowAcpSourceTransfer : undefined,
      acpConfigOptions:
        formExecutionMode === 'acp' && Object.keys(formAcpConfigOptions).length > 0
          ? formAcpConfigOptions
          : undefined,
      temperature: formTemp,
      reasoningEffort: savedReasoningEffort,
      fastMode: savedFastMode,
    };
    if (editingBotId) {
      updateGlobalReviewer(editingBotId, updates);
    } else {
      addGlobalReviewer({ ...updates, enabled: true, isBuiltin: false });
    }

    setIsFormOpen(false);
  };

  return {
    handleOpenAdd,
    handleOpenEdit,
    isFormOpen,
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
    providerPreset,
    effectiveProvider,
    inheritsGlobalModel,
    availableModels,
    executionModel,
    executionBaseUrl,
    setIsFormOpen,
    handleSaveForm,
  };
}
