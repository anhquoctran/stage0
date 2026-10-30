import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { Bot } from '../../../common/components/icons/Bot';
import { Check } from '../../../common/components/icons/Check';
import { ChevronDown } from '../../../common/components/icons/ChevronDown';
import { ChevronUp } from '../../../common/components/icons/ChevronUp';
import { Copy } from '../../../common/components/icons/Copy';
import { Edit2 } from '../../../common/components/icons/Edit2';
import { Plus } from '../../../common/components/icons/Plus';
import { RotateCcw } from '../../../common/components/icons/RotateCcw';
import { Search } from '../../../common/components/icons/Search';
import { Shield } from '../../../common/components/icons/Shield';
import { Trash2 } from '../../../common/components/icons/Trash2';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import { DEFAULT_AI_CONFIG } from '../constants/aiPresets';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { useBotReviewersStore } from '../store/useBotReviewersStore';
import type { AiSettingsTabProps } from '../types/AiSettingsTabProps';
import { BotReviewerCard } from './BotReviewerCard';
import { BotReviewerModal } from './BotReviewerModal';
import { BotReviewersResetModal } from './BotReviewersResetModal';
import { BotReviewersToolbar } from './BotReviewersToolbar';
import { useReviewerBotForm } from './useReviewerBotForm';

// Reference icons to ensure they stay linked in bundle and satisfy harness imports
void [
  Shield,
  Bot,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  AlertCircle,
];

export const BotReviewersTab: React.FC<AiSettingsTabProps> = ({ draftSettings } = {}) => {
  const { t } = useTranslation();
  const {
    aiConfig: committedAiConfig,
    dynamicModels,
    externalAgents: committedExternalAgents,
    fetchDynamicModels,
    isFetchingDynamicModels,
    dynamicModelError,
  } = useAiMcpStore();
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
  const {
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
    formTemp,
    setFormTemp,
    formReasoningEffort,
    setFormReasoningEffort,
    formFastMode,
    setFormFastMode,
    formError,
    effectiveProvider,
    inheritsGlobalModel,
    availableModels,
    executionModel,
    executionBaseUrl,
    setIsFormOpen,
    handleSaveForm,
    canSubmit,
    acpConfig,
  } = useReviewerBotForm({
    globalAiConfig,
    dynamicModels,
    externalAgents,
    updateGlobalReviewer,
    addGlobalReviewer,
  });

  // Confirm reset dialog
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
          <div className="p-8 text-center bg-surface0/20 border border-dashed border-surface1 space-y-2 rounded-sm">
            <Bot className="w-8 h-8 mx-auto text-subtext0/40" />
            <div className="text-xs text-subtext0 font-medium">
              {t('ai.botReviewers.noMatching')}
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setOnlyEnabled(false);
              }}
              className="text-xs text-brand hover:underline cursor-pointer rounded-sm"
            >
              {t('ai.botReviewers.clearFilters')}
            </button>
          </div>
        ) : (
          filteredBots.map((bot) => (
            <BotReviewerCard
              key={bot.id}
              bot={bot}
              externalAgents={externalAgents}
              isPromptExpanded={expandedPromptId === bot.id}
              onTogglePrompt={() =>
                setExpandedPromptId(expandedPromptId === bot.id ? null : bot.id)
              }
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
        dialog={{
          isOpen: isFormOpen,
          canSubmit,
          editingBotId: editingBotId,
          formError: formError,
          onClose: () => setIsFormOpen(false),
          onSubmit: handleSaveForm,
        }}
        identity={{
          formName: formName,
          setFormName: setFormName,
          formTagline: formTagline,
          setFormTagline: setFormTagline,
          formDesc: formDesc,
          setFormDesc: setFormDesc,
          formCategory: formCategory,
          setFormCategory: setFormCategory,
          formEmoji: formEmoji,
          setFormEmoji: setFormEmoji,
          formInstructions: formInstructions,
          setFormInstructions: setFormInstructions,
        }}
        execution={{
          acpConfig,
          formExecutionMode: formExecutionMode,
          setFormExecutionMode: setFormExecutionMode,
          formAcpAgentId: formAcpAgentId,
          setFormAcpAgentId: setFormAcpAgentId,
          formAllowAcpSourceTransfer: formAllowAcpSourceTransfer,
          setFormAllowAcpSourceTransfer: setFormAllowAcpSourceTransfer,
          formAcpConfigOptions: formAcpConfigOptions,
          setFormAcpConfigOptions: setFormAcpConfigOptions,
          formProvider: formProvider,
          setFormProvider: setFormProvider,
          formModel: formModel,
          setFormModel: setFormModel,
          formTemp: formTemp,
          setFormTemp: setFormTemp,
          formReasoningEffort: formReasoningEffort,
          setFormReasoningEffort: setFormReasoningEffort,
          formFastMode: formFastMode,
          setFormFastMode: setFormFastMode,
        }}
        catalog={{
          externalAgents: externalAgents,
          globalAiConfig: globalAiConfig,
          effectiveProvider: effectiveProvider,
          inheritsGlobalModel: inheritsGlobalModel,
          availableModels: availableModels,
          executionModel: executionModel,
          executionBaseUrl: executionBaseUrl,
          dynamicModels: dynamicModels,
          fetchDynamicModels,
          isFetchingDynamicModels,
          dynamicModelError,
        }}
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
