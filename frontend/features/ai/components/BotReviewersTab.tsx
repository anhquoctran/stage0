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
import { CustomSelect } from '../../../common/components/CustomSelect';
import { AiModelExecutionOptions } from './AiModelExecutionOptions';
import { AcpReviewerConfigOptions } from './AcpReviewerConfigOptions';
import type { AcpReviewConfigOverrides } from '../types/AcpReviewConfigOverrides';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { useBotReviewersStore } from '../store/useBotReviewersStore';
import { BOT_CATEGORIES } from '../constants/botPresets';
import { type BotReviewer } from '../../virtual-mr/types/BotReviewer';
import { type BotCategory } from '../../virtual-mr/types/BotCategory';
import { AI_PROVIDERS } from '../constants/aiPresets';
import { useAiMcpStore } from '../store/useAiMcpStore';
import type { AiModelPreset } from '../types/AiModelPreset';
import type { AiReasoningEffort } from '../types/AiReasoningEffort';
import type { AiSettingsTabProps } from '../types/AiSettingsTabProps';
import { resolveAiModelPreset } from '../utils/resolveAiModelPreset';
import { getBotRolePrompt } from '../utils/botRolePrompts';

const EMOJI_PRESETS = ['🛡️', '⚡', '🏗️', '🐛', '📝', '🎨', '🔒', '🚀', '🧪', '🔍', '⚙️', '💎'];
const CUSTOM_MODEL_OPTION = '__stage0_custom_model__';

const BOT_CATEGORY_OPTIONS: CustomSelectOption<BotCategory>[] = BOT_CATEGORIES.map((category) => ({
  value: category.id,
  label: category.label,
}));

const BOT_PROVIDER_OPTIONS: CustomSelectOption<string>[] = [
  { value: 'global_default', label: 'Global Default (from AI tab)' },
  ...AI_PROVIDERS.map((provider) => ({ value: provider.id, label: provider.name })),
];
const BOT_EXECUTION_OPTIONS: CustomSelectOption<'provider' | 'acp'>[] = [
  { value: 'provider', label: 'Built-in LLM provider' },
  { value: 'acp', label: 'ACP Agent' },
];

export const BotReviewersTab: React.FC<AiSettingsTabProps> = ({ draftSettings } = {}) => {
  const { aiConfig: committedAiConfig, dynamicModels, externalAgents: committedExternalAgents } = useAiMcpStore();
  const globalAiConfig = draftSettings?.aiConfig || committedAiConfig;
  const externalAgents = draftSettings?.externalAgents || committedExternalAgents;
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

  // Form modal state
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
  // Reuse already-discovered models and offline presets. Opening this editor
  // must not read Keychain credentials or automatically contact a provider.
  const availableModels = useMemo(() => {
    const candidates = [...(providerPreset ? dynamicModels[providerPreset.id] || [] : []), ...(providerPreset?.models || [])];
    if (effectiveProvider === globalAiConfig.provider && globalAiConfig.model && !candidates.some((model) => model.id === globalAiConfig.model)) {
      candidates.push({ id: globalAiConfig.model, name: globalAiConfig.model });
    }
    const models = new Map<string, AiModelPreset>();
    for (const model of candidates) if (model.id && !models.has(model.id)) models.set(model.id, model);
    return [...models.values()];
  }, [dynamicModels, providerPreset, effectiveProvider, globalAiConfig.provider, globalAiConfig.model]);
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
  const executionModelId = inheritsGlobalModel
    ? globalAiConfig.model
    : formModel === 'global_default'
      ? providerPreset?.defaultModel || ''
      : formModel;
  const executionBaseUrl = formProvider === 'global_default'
    ? globalAiConfig.baseUrl
    : providerPreset?.defaultBaseUrl || '';
  const executionModel = resolveAiModelPreset(
    effectiveProvider,
    executionModelId,
    executionBaseUrl,
    dynamicModels[effectiveProvider as keyof typeof dynamicModels] || [],
  );

  // Filtered reviewers
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

  const enabledCount = globalReviewers.filter((b) => b.enabled).length;
  const customCount = globalReviewers.filter((b) => !b.isBuiltin).length;

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
    if (formExecutionMode === 'acp' && !externalAgents.some((agent) => agent.id === formAcpAgentId)) {
      setFormError('Choose an installed ACP agent. Add one in AI Preferences → External Agents first.');
      return;
    }
    const acpMode = formExecutionMode === 'acp';
    const savedReasoningEffort = !acpMode && !inheritsGlobalModel && executionModel?.reasoningEfforts?.includes(formReasoningEffort as AiReasoningEffort)
      ? formReasoningEffort
      : undefined;
    const savedFastMode = acpMode ? undefined : inheritsGlobalModel
      ? undefined
      : executionModel?.supportsFastMode === true
        ? formFastMode
        : false;

    if (editingBotId) {
      updateGlobalReviewer(editingBotId, {
        name: formName.trim(),
        tagline: formTagline.trim(),
        description: formDesc.trim(),
        category: formCategory,
        avatarEmoji: formEmoji,
        customInstructions: formInstructions.trim(),
        provider: acpMode ? 'global_default' : formProvider,
        model: acpMode ? 'global_default' : formModel.trim(),
        acpAgentId: acpMode ? formAcpAgentId : undefined,
        allowAcpSourceTransfer: acpMode ? formAllowAcpSourceTransfer : undefined,
        acpConfigOptions: acpMode ? formAcpConfigOptions : undefined,
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
        provider: acpMode ? 'global_default' : formProvider,
        model: acpMode ? 'global_default' : formModel.trim(),
        acpAgentId: acpMode ? formAcpAgentId : undefined,
        allowAcpSourceTransfer: acpMode ? formAllowAcpSourceTransfer : undefined,
        acpConfigOptions: acpMode ? formAcpConfigOptions : undefined,
        temperature: formTemp,
        reasoningEffort: savedReasoningEffort,
        fastMode: savedFastMode,
        enabled: true,
        isBuiltin: false,
      });
    }

    setIsFormOpen(false);
  };

  const getCategoryInfo = (cat: BotCategory) => {
    return (
      BOT_CATEGORIES.find((c) => c.id === cat) || {
        id: cat,
        label: cat,
        color: 'var(--ctp-subtext0)',
        bg: 'bg-surface1 text-subtext0 border-surface2',
      }
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-100">
      {/* Tab Header */}
      <div className="pb-3 border-b border-surface0 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand" />
            Global Bot Reviewers
          </h3>
          <p className="text-[11px] text-subtext0 mt-0.5">
            Configure default AI Reviewer bots available across all repositories. Repositories inherit these settings by default.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="px-2.5 py-1.5 bg-surface0 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-surface1"
            title="Reset to default builtin bots"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-3 py-1.5 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Reviewer</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-surface0/30 border border-surface0 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-subtext0 tracking-wider">Total Bots</span>
            <div className="text-lg font-bold text-text mt-0.5">{globalReviewers.length}</div>
          </div>
          <div className="w-8 h-8  bg-surface0 flex items-center justify-center text-subtext0">
            <Bot className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 bg-surface0/30 border border-surface0 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-subtext0 tracking-wider">Active in Global</span>
            <div className="text-lg font-bold text-brand mt-0.5">{enabledCount}</div>
          </div>
          <div className="w-8 h-8  bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <Check className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 bg-surface0/30 border border-surface0 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-subtext0 tracking-wider">Custom Bots</span>
            <div className="text-lg font-bold text-brand mt-0.5">{customCount}</div>
          </div>
          <div className="w-8 h-8  bg-surface0 flex items-center justify-center text-subtext0">
            <Bot className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Toolbar: Search & Category Filter */}
      <div className="p-3 bg-surface0/20 border border-surface0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-subtext0" />
            <input
              type="text"
              placeholder="Search reviewer bots by name, category, or prompt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface0 border border-surface1  text-xs text-text placeholder:text-subtext0/60 focus:outline-none focus:border-brand"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-subtext0 cursor-pointer shrink-0 select-none">
            <input
              type="checkbox"
              checked={onlyEnabled}
              onChange={(e) => setOnlyEnabled(e.target.checked)}
              className=" border-surface1 text-brand focus:ring-0 cursor-pointer"
            />
            <span>Enabled only</span>
          </label>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 text-xs  transition-colors cursor-pointer border ${
              selectedCategory === 'all'
                ? 'bg-surface2 text-text font-medium border-surface2'
                : 'bg-surface0/60 text-subtext0 hover:bg-surface0 border-transparent'
            }`}
          >
            All ({globalReviewers.length})
          </button>
          {BOT_CATEGORIES.map((cat) => {
            const count = globalReviewers.filter((b) => b.category === cat.id).length;
            if (count === 0 && cat.id !== 'custom') return null;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2 py-1 text-xs  transition-colors cursor-pointer border ${
                  selectedCategory === cat.id
                    ? `${cat.bg} font-medium`
                    : 'bg-surface0/60 text-subtext0 hover:bg-surface0 border-transparent'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Reviewer Cards List */}
      <div className="space-y-3">
        {filteredBots.length === 0 ? (
          <div className="p-8 text-center bg-surface0/20 border border-dashed border-surface1  space-y-2">
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
          filteredBots.map((bot) => {
            const cat = getCategoryInfo(bot.category);
            const isPromptExpanded = expandedPromptId === bot.id;

            return (
              <div
                key={bot.id}
                className={`p-4 bg-surface0/30 border transition-all ${
                  bot.enabled
                    ? 'border-surface0 hover:border-surface1'
                    : 'border-surface0/50 opacity-65 bg-surface0/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl p-1.5 bg-surface0 border border-surface1  shrink-0">
                      {bot.avatarEmoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-text truncate">{bot.name}</span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold border  ${cat.bg}`}
                        >
                          {cat.label}
                        </span>
                        {bot.isBuiltin ? (
                          <span className="px-1.5 py-0.2 text-[9px] font-mono bg-surface1 text-subtext0  border border-surface2/60">
                            Built-in
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 text-[9px] font-mono bg-brand/10 text-brand  border border-brand/20">
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-subtext0 font-mono mt-0.5 truncate">
                        {bot.tagline}
                      </div>
                      <p className="text-xs text-subtext0/90 mt-1 line-clamp-2 leading-relaxed">
                        {bot.description}
                      </p>
                    </div>
                  </div>

                  {/* Switch Toggle */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={bot.enabled}
                      onClick={() => toggleGlobalReviewer(bot.id)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        bot.enabled ? 'bg-brand' : 'bg-surface1'
                      }`}
                      title={bot.enabled ? 'Click to disable globally' : 'Click to enable globally'}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-base shadow-lg ring-0 transition duration-200 ease-in-out ${
                          bot.enabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Prompt & Config Bar */}
                <div className="mt-3 pt-3 border-t border-surface0/60 flex items-center justify-between text-xs text-subtext0">
                  <div className="flex items-center gap-3 flex-wrap text-[11px]">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPromptId(isPromptExpanded ? null : bot.id)
                      }
                      className="flex items-center gap-1 hover:text-text cursor-pointer font-medium text-brand"
                    >
                      {isPromptExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Hide System Prompt</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Inspect System Prompt</span>
                        </>
                      )}
                    </button>

                    <span className="text-surface2">|</span>

                    <span className="font-mono text-subtext0/80">
                      {bot.acpAgentId ? 'ACP agent: ' : 'Model: '}
                      <strong className="text-text font-normal">
                        {bot.acpAgentId
                          ? externalAgents.find((agent) => agent.id === bot.acpAgentId)?.name || 'Agent unavailable'
                          : bot.model === 'global_default' || !bot.model ? 'Global Default' : bot.model}
                      </strong>
                    </span>
                    {bot.acpAgentId && !bot.allowAcpSourceTransfer && (
                      <span className="font-mono text-yellow">ACP source consent required</span>
                    )}

                    {bot.temperature !== undefined && (
                      <span className="font-mono text-subtext0/80">
                        Temp: <strong className="text-text font-normal">{bot.temperature}</strong>
                      </span>
                    )}
                    {bot.reasoningEffort && (
                      <span className="font-mono text-subtext0/80">
                        Effort: <strong className="text-text font-normal">{bot.reasoningEffort}</strong>
                      </span>
                    )}
                    {bot.fastMode === true && (
                      <span className="font-mono text-subtext0/80">Fast mode</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCloneBot(bot)}
                      className="p-1.5 hover:bg-surface0  text-subtext0 hover:text-text transition-colors cursor-pointer"
                      title="Clone this reviewer bot"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(bot)}
                      className="p-1.5 hover:bg-surface0  text-subtext0 hover:text-text transition-colors cursor-pointer"
                      title="Edit bot settings and prompt"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!bot.isBuiltin && (
                      <button
                        type="button"
                        onClick={() => deleteGlobalReviewer(bot.id)}
                        className="p-1.5 hover:bg-red/20  text-subtext0 hover:text-red transition-colors cursor-pointer"
                        title="Delete custom bot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Prompt Viewer */}
                {isPromptExpanded && (
                  <div className="mt-3 p-3 bg-crust border border-surface0/80  space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[11px] text-subtext0 font-mono">
                      <span>STAGE0 ROLE PROMPT · {getCategoryInfo(bot.category).label.toUpperCase()}</span>
                      <span>{getBotRolePrompt(bot.category).length} characters</span>
                    </div>
                    <pre className="text-xs font-mono text-subtext1 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto select-text p-1">
                      {getBotRolePrompt(bot.category)}
                    </pre>
                    {bot.customInstructions.trim() && <>
                      <div className="flex items-center justify-between text-[11px] text-subtext0 font-mono pt-2">
                        <span>USER ADDITIONAL INSTRUCTIONS</span>
                        <span>{bot.customInstructions.length} characters</span>
                      </div>
                      <pre className="text-xs font-mono text-subtext1 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto select-text p-1">
                        {bot.customInstructions}
                      </pre>
                    </>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* CREATE / EDIT BOT MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-mantle border border-surface0 w-full max-w-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface0 pb-3">
              <h4 className="text-sm font-bold text-text flex items-center gap-2">
                <Bot className="w-4 h-4 text-brand" />
                {editingBotId ? 'Edit Reviewer Bot' : 'Create Custom Reviewer Bot'}
              </h4>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-subtext0 hover:text-text cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-red/10 border border-red/20 text-red text-xs  flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveForm} className="space-y-4">
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
                      className="w-12 h-9 text-center text-lg bg-surface0 border border-surface1  text-text focus:outline-none focus:border-brand"
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
                    className="w-full px-3 py-1.5 bg-surface0 border border-surface1  text-xs text-text focus:outline-none focus:border-brand"
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
                    className="w-full px-3 py-1.5 bg-surface0 border border-surface1  text-xs text-text focus:outline-none focus:border-brand"
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
                  className="w-full px-3 py-1.5 bg-surface0 border border-surface1  text-xs text-text focus:outline-none focus:border-brand"
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
                <pre className="w-full max-h-36 overflow-y-auto whitespace-pre-wrap px-3 py-2 bg-crust border border-surface1  text-xs font-mono text-subtext1 leading-relaxed select-text">
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
                  className="w-full px-3 py-2 bg-surface0 border border-surface1  text-xs font-mono text-text focus:outline-none focus:border-brand leading-relaxed"
                />
              </div>

              {/* Model & Execution Parameters */}
              <div className="p-3 bg-surface0/30 border border-surface0  space-y-3">
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
                      if (mode === 'acp' && !formAcpAgentId) setFormAcpAgentId(externalAgents[0]?.id || '');
                    }}
                    className="w-full"
                    buttonClassName="w-full"
                    dropdownWidth="w-full"
                    align="left"
                    aria-label="Reviewer execution engine"
                  />
                </div>
                {formExecutionMode === 'provider' ? <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-subtext0 mb-1">Provider</label>
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
                          const preset = AI_PROVIDERS.find((prov) => prov.id === p);
                          if (preset) setFormModel(preset.defaultModel);
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
                    {isCustomModel && <input
                      type="text"
                      aria-label="Custom model ID"
                      required
                      value={formModel}
                      onChange={(e) => setFormModel(e.target.value)}
                      placeholder="Enter custom model ID"
                      className="mt-2 w-full px-2 py-1.5 bg-surface0 border border-surface1  text-xs text-text focus:outline-none focus:border-brand font-mono"
                    />}
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
                </> : <div className="space-y-3 border border-surface0 bg-crust/50 p-3">
                  <div>
                    <label className="block text-[10px] text-subtext0 mb-1">Installed ACP agent</label>
                    {externalAgents.length > 0 ? <CustomSelect
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
                    /> : <p className="border border-yellow/40 bg-yellow/5 p-2 text-[10px] text-yellow">No ACP agents are installed. Add one in AI Preferences → External Agents.</p>}
                  </div>
                  <AcpReviewerConfigOptions
                    agent={externalAgents.find((agent) => agent.id === formAcpAgentId)}
                    value={formAcpConfigOptions}
                    onChange={setFormAcpConfigOptions}
                  />
                  <label className="flex items-start gap-2 text-[10px] text-subtext0">
                    <input type="checkbox" checked={formAllowAcpSourceTransfer} onChange={(event) => setFormAllowAcpSourceTransfer(event.target.checked)} className="mt-0.5 accent-brand" />
                    <span>I allow this ACP agent to receive eligible changed-file diffs and review context. Sensitive paths are excluded and matching secret lines are redacted, but detection cannot catch every secret. This consent is used for automatic reviews assigned to this bot.</span>
                  </label>
                  <p className="text-[10px] text-subtext0">Stage0 still validates tool requests, finding evidence, and changed-line coordinates. The agent runs outside the repository directory; its own runtime and policies are managed by its publisher.</p>
                </div>}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-1.5 bg-surface0 hover:bg-surface1 text-text text-xs  transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs  transition-colors cursor-pointer shadow-xs"
                >
                  {editingBotId ? 'Update Bot' : 'Create Bot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-mantle border border-surface0 w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3 text-yellow">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-text">Reset Default Bot Reviewers?</h4>
            </div>
            <p className="text-xs text-subtext0 leading-relaxed">
              This will reset the reviewer bots list to defaults and remove any custom configured bots.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 bg-surface0 hover:bg-surface1 text-text text-xs  cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetGlobalReviewers();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-1.5 bg-yellow hover:brightness-95 text-on-accent font-semibold text-xs  cursor-pointer shadow-xs"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
