import React, { useState, useMemo } from 'react';
import {
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
} from '@/common/components/icons';
import { useBotReviewersStore } from '../store/useBotReviewersStore';
import { BOT_CATEGORIES } from '../constants/botPresets';
import { BotReviewer, BotCategory } from '../../virtual-mr/types/virtualMr';
import { AI_PROVIDERS } from '../constants/aiPresets';

const EMOJI_PRESETS = ['🛡️', '⚡', '🏗️', '🐛', '📝', '🎨', '🔒', '🚀', '🧪', '🔍', '⚙️', '💎'];

export const BotReviewersTab: React.FC = () => {
  const {
    globalReviewers,
    addGlobalReviewer,
    updateGlobalReviewer,
    deleteGlobalReviewer,
    toggleGlobalReviewer,
    resetGlobalReviewers,
  } = useBotReviewersStore();

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
  const [formPrompt, setFormPrompt] = useState('');
  const [formProvider, setFormProvider] = useState<string>('global_default');
  const [formModel, setFormModel] = useState<string>('global_default');
  const [formTemp, setFormTemp] = useState<number>(0.2);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirm reset dialog
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
        bot.systemPrompt.toLowerCase().includes(q)
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
    setFormPrompt(`You are a specialized code reviewer bot.
Analyze incoming code diffs and discussions:
1. Identify logic flaws, regressions, and security anomalies.
2. Provide clear, actionable recommendations with code examples.
3. Be respectful, concise, and focused on code quality.`);
    setFormProvider('global_default');
    setFormModel('global_default');
    setFormTemp(0.2);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (bot: BotReviewer) => {
    setEditingBotId(bot.id);
    setFormName(bot.name);
    setFormTagline(bot.tagline);
    setFormDesc(bot.description);
    setFormCategory(bot.category);
    setFormEmoji(bot.avatarEmoji);
    setFormPrompt(bot.systemPrompt);
    setFormProvider(bot.provider || 'global_default');
    setFormModel(bot.model || 'global_default');
    setFormTemp(bot.temperature ?? 0.2);
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
      systemPrompt: bot.systemPrompt,
      provider: bot.provider,
      model: bot.model,
      temperature: bot.temperature,
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
    if (!formPrompt.trim()) {
      setFormError('System prompt instructions are required');
      return;
    }

    if (editingBotId) {
      updateGlobalReviewer(editingBotId, {
        name: formName.trim(),
        tagline: formTagline.trim(),
        description: formDesc.trim(),
        category: formCategory,
        avatarEmoji: formEmoji,
        systemPrompt: formPrompt.trim(),
        provider: formProvider,
        model: formModel,
        temperature: formTemp,
      });
    } else {
      addGlobalReviewer({
        name: formName.trim(),
        tagline: formTagline.trim(),
        description: formDesc.trim(),
        category: formCategory,
        avatarEmoji: formEmoji,
        systemPrompt: formPrompt.trim(),
        provider: formProvider,
        model: formModel,
        temperature: formTemp,
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
          <div className="w-8 h-8 rounded-lg bg-surface0 flex items-center justify-center text-subtext0">
            <Bot className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 bg-surface0/30 border border-surface0 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-subtext0 tracking-wider">Active in Global</span>
            <div className="text-lg font-bold text-brand mt-0.5">{enabledCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
            <Check className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3 bg-surface0/30 border border-surface0 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-subtext0 tracking-wider">Custom Bots</span>
            <div className="text-lg font-bold text-brand mt-0.5">{customCount}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-surface0 flex items-center justify-center text-subtext0">
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
              className="w-full pl-8 pr-3 py-1.5 bg-surface0 border border-surface1 rounded text-xs text-text placeholder:text-subtext0/60 focus:outline-none focus:border-brand"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-subtext0 cursor-pointer shrink-0 select-none">
            <input
              type="checkbox"
              checked={onlyEnabled}
              onChange={(e) => setOnlyEnabled(e.target.checked)}
              className="rounded border-surface1 text-brand focus:ring-0 cursor-pointer"
            />
            <span>Enabled only</span>
          </label>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer border ${
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
                className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer border ${
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
          <div className="p-8 text-center bg-surface0/20 border border-dashed border-surface1 rounded space-y-2">
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
                    <span className="text-2xl p-1.5 bg-surface0 border border-surface1 rounded-lg shrink-0">
                      {bot.avatarEmoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-text truncate">{bot.name}</span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold border rounded-full ${cat.bg}`}
                        >
                          {cat.label}
                        </span>
                        {bot.isBuiltin ? (
                          <span className="px-1.5 py-0.2 text-[9px] font-mono bg-surface1 text-subtext0 rounded border border-surface2/60">
                            Built-in
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 text-[9px] font-mono bg-brand/10 text-brand rounded border border-brand/20">
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
                      Model:{' '}
                      <strong className="text-text font-normal">
                        {bot.model === 'global_default' || !bot.model
                          ? 'Global Default'
                          : bot.model}
                      </strong>
                    </span>

                    {bot.temperature !== undefined && (
                      <span className="font-mono text-subtext0/80">
                        Temp: <strong className="text-text font-normal">{bot.temperature}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCloneBot(bot)}
                      className="p-1.5 hover:bg-surface0 rounded text-subtext0 hover:text-text transition-colors cursor-pointer"
                      title="Clone this reviewer bot"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(bot)}
                      className="p-1.5 hover:bg-surface0 rounded text-subtext0 hover:text-text transition-colors cursor-pointer"
                      title="Edit bot settings and prompt"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {!bot.isBuiltin && (
                      <button
                        type="button"
                        onClick={() => deleteGlobalReviewer(bot.id)}
                        className="p-1.5 hover:bg-red/20 rounded text-subtext0 hover:text-red transition-colors cursor-pointer"
                        title="Delete custom bot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Prompt Viewer */}
                {isPromptExpanded && (
                  <div className="mt-3 p-3 bg-crust border border-surface0/80 rounded space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between text-[11px] text-subtext0 font-mono">
                      <span>SYSTEM_PROMPT</span>
                      <span>{bot.systemPrompt.length} characters</span>
                    </div>
                    <pre className="text-xs font-mono text-subtext1 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto select-text p-1">
                      {bot.systemPrompt}
                    </pre>
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
              <div className="p-2.5 bg-red/10 border border-red/20 text-red text-xs rounded flex items-center gap-2">
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
                      className="w-12 h-9 text-center text-lg bg-surface0 border border-surface1 rounded text-text focus:outline-none focus:border-brand"
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
                    className="w-full px-3 py-1.5 bg-surface0 border border-surface1 rounded text-xs text-text focus:outline-none focus:border-brand"
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
                    className="w-full px-3 py-1.5 bg-surface0 border border-surface1 rounded text-xs text-text focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-subtext0 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as BotCategory)}
                    className="w-full px-3 py-1.5 bg-surface0 border border-surface1 rounded text-xs text-text focus:outline-none focus:border-brand cursor-pointer"
                  >
                    {BOT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
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
                  className="w-full px-3 py-1.5 bg-surface0 border border-surface1 rounded text-xs text-text focus:outline-none focus:border-brand"
                />
              </div>

              {/* System Prompt */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-subtext0">
                    System Prompt Instructions *
                  </label>
                  <span className="text-[10px] text-subtext0 font-mono">
                    Executed when reviewing Virtual MR diffs
                  </span>
                </div>
                <textarea
                  rows={7}
                  required
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="Define role, review criteria, rules to enforce, and preferred response format..."
                  className="w-full px-3 py-2 bg-surface0 border border-surface1 rounded text-xs font-mono text-text focus:outline-none focus:border-brand leading-relaxed"
                />
              </div>

              {/* Model & Execution Parameters */}
              <div className="p-3 bg-surface0/30 border border-surface0 rounded space-y-3">
                <span className="text-[11px] font-bold text-text uppercase tracking-wider block">
                  Model &amp; Execution Override (Optional)
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-subtext0 mb-1">Provider</label>
                    <select
                      value={formProvider}
                      onChange={(e) => {
                        const p = e.target.value;
                        setFormProvider(p);
                        if (p === 'global_default') {
                          setFormModel('global_default');
                        } else {
                          const preset = AI_PROVIDERS.find((prov) => prov.id === p);
                          if (preset) setFormModel(preset.defaultModel);
                        }
                      }}
                      className="w-full px-2 py-1.5 bg-surface0 border border-surface1 rounded text-xs text-text focus:outline-none cursor-pointer"
                    >
                      <option value="global_default">Global Default (from AI tab)</option>
                      {AI_PROVIDERS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-subtext0 mb-1">Model Name</label>
                    <input
                      type="text"
                      value={formModel}
                      onChange={(e) => setFormModel(e.target.value)}
                      placeholder="e.g. gpt-4o, claude-3-5-sonnet"
                      className="w-full px-2 py-1.5 bg-surface0 border border-surface1 rounded text-xs text-text focus:outline-none font-mono"
                    />
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
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-1.5 bg-surface0 hover:bg-surface1 text-text text-xs rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs rounded transition-colors cursor-pointer shadow-xs"
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
                className="px-3 py-1.5 bg-surface0 hover:bg-surface1 text-text text-xs rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetGlobalReviewers();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-1.5 bg-yellow hover:brightness-95 text-on-accent font-semibold text-xs rounded cursor-pointer shadow-xs"
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
