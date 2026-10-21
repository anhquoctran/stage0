import React, { useState, useMemo } from 'react';
import { Shield } from '../../../common/components/icons/Shield';
import { Bot } from '../../../common/components/icons/Bot';
import { Plus } from '../../../common/components/icons/Plus';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { Edit2 } from '../../../common/components/icons/Edit2';
import { RotateCcw } from '../../../common/components/icons/RotateCcw';
import { Check } from '../../../common/components/icons/Check';
import { Search } from '../../../common/components/icons/Search';
import { ChevronDown } from '../../../common/components/icons/ChevronDown';
import { ChevronUp } from '../../../common/components/icons/ChevronUp';
import { Copy } from '../../../common/components/icons/Copy';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { useBotReviewersStore } from '../store/useBotReviewersStore';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { AI_PROVIDERS, DEFAULT_AI_CONFIG } from '../constants/aiPresets';
import { resolveAiModelPreset } from '../utils/resolveAiModelPreset';
import { BotReviewersToolbar } from './BotReviewersToolbar';
import { BotReviewerCard } from './BotReviewerCard';
import { BotReviewerModal } from './BotReviewerModal';
import { BotReviewersResetModal } from './BotReviewersResetModal';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import type { AiReasoningEffort } from '../types/AiReasoningEffort';
import type { AcpReviewConfigOverrides } from '../types/AcpReviewConfigOverrides';
import type { AiModelPreset } from '../types/AiModelPreset';
import type { AiSettingsTabProps } from '../types/AiSettingsTabProps';

// Reference icons to ensure they stay linked in bundle and satisfy harness imports
void [Shield, Bot, Plus, Trash2, Edit2, RotateCcw, Check, Search, ChevronDown, ChevronUp, Copy, AlertCircle];

export const BotReviewersTab: React.FC<AiSettingsTabProps> = ({ draftSettings } = {}) => {
  const { aiConfig: committedAiConfig, dynamicModels, externalAgents: committedExternalAgents } = useAiMcpStore();
  const globalAiConfig = draftSettings?.aiConfig || committedAiConfig || DEFAULT_AI_CONFIG;
  const externalAgents = draftSettings?.externalAgents || committedExternalAgents || [];
  const {
    globalReviewers,
    addGlobalReviewer,
    updateGlobalReviewer,
    deleteGlobalReviewer,
    toggleGlobalReviewer,
    resetGlobalReviewers,
  } = { ...useBotReviewersStore(), ...draftSettings };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);

  // Form / Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formCategory, setFormCategory] = useState<BotCategory>('custom');
  const [formEmoji, setFormEmoji] = useState('🤖');
  const [formInstructions, setFormInstructions] = useState('');
  const [formExecutionMode, setFormExecutionMode] = useState<'provider' | 'acp'>('provider');
  const [formAcpAgentId, setFormAcpAgentId] = useState('');
  const [formAllowAcpSourceTransfer, setFormAllowAcpSourceTransfer] = useState(false);
  const [formAcpConfigOptions, setFormAcpConfigOptions] = useState<AcpReviewConfigOverrides>({});
  const [formProvider, setFormProvider] = useState<string>('global_default');
  const [formModel, setFormModel] = useState<string>('global_default');
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [formTemp, setFormTemp] = useState<number>(0.2);
  const [formReasoningEffort, setFormReasoningEffort] = useState<AiReasoningEffort | undefined>();
  const [formFastMode, setFormFastMode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirm reset dialog
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const effectiveProvider = formProvider === 'global_default' ? globalAiConfig.provider : formProvider;
  const providerPreset = AI_PROVIDERS.find((provider) => provider.id === effectiveProvider);
  const inheritsGlobalModel = formProvider === 'global_default' && formModel === 'global_default';

  const availableModels = useMemo(() => {
    const candidates = [...(providerPreset ? dynamicModels[providerPreset.id] || [] : []), ...(providerPreset?.models || [])];
    if (effectiveProvider === globalAiConfig.provider && globalAiConfig.model && !candidates.some((model) => model.id === globalAiConfig.model)) {
      candidates.push({ id: globalAiConfig.model, name: globalAiConfig.model });
    }
    const models = new Map<string, AiModelPreset>();
    for (const model of candidates) if (model.id && !models.has(model.id)) models.set(model.id, model);
    return [...models.values()];
  }, [dynamicModels, providerPreset, effectiveProvider, globalAiConfig.provider, globalAiConfig.model]);

  const executionModelId = inheritsGlobalModel
    ? globalAiConfig.model
    : formModel === 'global_default'
      ? providerPreset?.defaultModel || globalAiConfig.model
      : formModel;
  const executionBaseUrl = (formProvider === 'global_default' ? globalAiConfig.baseUrl : providerPreset?.defaultBaseUrl) || '';
  const executionModel = resolveAiModelPreset(
    effectiveProvider,
    executionModelId,
    executionBaseUrl,
    dynamicModels[effectiveProvider as keyof typeof dynamicModels] || [],
  );

  const filteredBots = useMemo(() => {
    return globalReviewers.filter((bot) => {
      if (onlyEnabled && !bot.enabled) return false;
      if (selectedCategory !== 'all' && bot.category !== selectedCategory) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        bot.name.toLowerCase().includes(q) ||
        bot.tagline.toLowerCase().includes(q) ||
        bot.description.toLowerCase().includes(q) ||
        bot.customInstructions.toLowerCase().includes(q)
      );
    });
  }, [globalReviewers, searchQuery, selectedCategory, onlyEnabled]);

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

  const handleCloneBot = (bot: BotReviewer) => {
    addGlobalReviewer({
      name: `${bot.name} (Copy)`,
      tagline: bot.tagline,
      description: bot.description,
      category: bot.category,
      avatarEmoji: bot.avatarEmoji,
      customInstructions: bot.customInstructions,
      provider: bot.provider,
      model: bot.model,
      acpAgentId: bot.acpAgentId,
      allowAcpSourceTransfer: bot.allowAcpSourceTransfer,
      acpConfigOptions: bot.acpConfigOptions,
      temperature: bot.temperature,
      reasoningEffort: bot.reasoningEffort,
      fastMode: bot.fastMode,
      enabled: true,
      isBuiltin: false,
    });
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

    const savedReasoningEffort = inheritsGlobalModel ? undefined : executionModel?.reasoningEfforts?.includes(formReasoningEffort as AiReasoningEffort) ? formReasoningEffort : undefined;
    const savedFastMode = inheritsGlobalModel ? undefined : executionModel?.supportsFastMode ? formFastMode : undefined;

    if (editingBotId) {
      updateGlobalReviewer(editingBotId, {
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
        acpConfigOptions: formExecutionMode === 'acp' && Object.keys(formAcpConfigOptions).length > 0 ? formAcpConfigOptions : undefined,
        temperature: formTemp,
        reasoningEffort: savedReasoningEffort,
        fastMode: savedFastMode,
      });
    } else {
      addGlobalReviewer({
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
        acpConfigOptions: formExecutionMode === 'acp' && Object.keys(formAcpConfigOptions).length > 0 ? formAcpConfigOptions : undefined,
        temperature: formTemp,
        reasoningEffort: savedReasoningEffort,
        fastMode: savedFastMode,
        enabled: true,
        isBuiltin: false,
      });
    }

    setIsFormOpen(false);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-100">
      <BotReviewersToolbar
        globalReviewers={globalReviewers}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        onlyEnabled={onlyEnabled}
        setOnlyEnabled={setOnlyEnabled}
        onOpenAdd={handleOpenAdd}
        onOpenResetConfirm={() => setShowResetConfirm(true)}
      />

      {/* Reviewer Cards List */}
      <div className="space-y-3">
        {filteredBots.length === 0 ? (
          <div className="p-8 text-center bg-surface0/20 border border-dashed border-surface1 space-y-2">
            <Bot className="w-8 h-8 mx-auto text-subtext0/40" />
            <div className="text-xs text-subtext0 font-medium">No reviewer bots found matching your criteria</div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setOnlyEnabled(false);
              }}
              className="text-xs text-brand hover:underline cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          filteredBots.map((bot) => (
            <BotReviewerCard
              key={bot.id}
              bot={bot}
              externalAgents={externalAgents}
              isPromptExpanded={expandedPromptId === bot.id}
              onTogglePrompt={() => setExpandedPromptId(expandedPromptId === bot.id ? null : bot.id)}
              onToggleEnabled={(id) => toggleGlobalReviewer(id)}
              onOpenEdit={handleOpenEdit}
              onCloneBot={handleCloneBot}
              onDeleteBot={(id) => deleteGlobalReviewer(id)}
            />
          ))
        )}
      </div>

      {/* Modal Add/Edit */}
      <BotReviewerModal
        isOpen={isFormOpen}
        editingBotId={editingBotId}
        formName={formName}
        setFormName={setFormName}
        formTagline={formTagline}
        setFormTagline={setFormTagline}
        formDesc={formDesc}
        setFormDesc={setFormDesc}
        formCategory={formCategory}
        setFormCategory={setFormCategory}
        formEmoji={formEmoji}
        setFormEmoji={setFormEmoji}
        formInstructions={formInstructions}
        setFormInstructions={setFormInstructions}
        formExecutionMode={formExecutionMode}
        setFormExecutionMode={setFormExecutionMode}
        formAcpAgentId={formAcpAgentId}
        setFormAcpAgentId={setFormAcpAgentId}
        formAllowAcpSourceTransfer={formAllowAcpSourceTransfer}
        setFormAllowAcpSourceTransfer={setFormAllowAcpSourceTransfer}
        formAcpConfigOptions={formAcpConfigOptions}
        setFormAcpConfigOptions={setFormAcpConfigOptions}
        formProvider={formProvider}
        setFormProvider={setFormProvider}
        formModel={formModel}
        setFormModel={setFormModel}
        isCustomModel={isCustomModel}
        setIsCustomModel={setIsCustomModel}
        formTemp={formTemp}
        setFormTemp={setFormTemp}
        formReasoningEffort={formReasoningEffort}
        setFormReasoningEffort={setFormReasoningEffort}
        formFastMode={formFastMode}
        setFormFastMode={setFormFastMode}
        formError={formError}
        externalAgents={externalAgents}
        globalAiConfig={globalAiConfig}
        providerPreset={providerPreset}
        effectiveProvider={effectiveProvider}
        inheritsGlobalModel={inheritsGlobalModel}
        availableModels={availableModels}
        executionModel={executionModel}
        executionBaseUrl={executionBaseUrl}
        dynamicModels={dynamicModels}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSaveForm}
      />

      {/* Reset Confirmation Modal */}
      <BotReviewersResetModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={() => {
          resetGlobalReviewers();
          setShowResetConfirm(false);
        }}
      />
    </div>
  );
};
