import React, { useMemo, useState } from 'react';
import { ShieldCheck } from '../../../../common/components/icons/ShieldCheck';
import { ExternalLink } from '../../../../common/components/icons/ExternalLink';
import { RotateCcw } from '../../../../common/components/icons/RotateCcw';
import { Shield } from '../../../../common/components/icons/Shield';
import { Plus } from '../../../../common/components/icons/Plus';
import { Bot } from '../../../../common/components/icons/Bot';
import { Check } from '../../../../common/components/icons/Check';
import { Trash2 } from '../../../../common/components/icons/Trash2';
import { Sparkles } from '../../../../common/components/icons/Sparkles';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { AcpReviewerConfigOptions } from '../../../ai/components/AcpReviewerConfigOptions';
import type { AcpReviewConfigOverrides } from '../../../ai/types/AcpReviewConfigOverrides';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import { useGitStore } from '../../store/useGitStore';
import { useAiMcpStore } from '../../../ai/store/useAiMcpStore';
import { useBotReviewersStore } from '../../../ai/store/useBotReviewersStore';
import { usePreferencesStore } from '../../../preferences/store/usePreferencesStore';
import { BOT_CATEGORIES } from '../../../ai/constants/botPresets';
import type { BotCategory } from '../../../virtual-mr/types/BotCategory';
import { getBotRolePrompt } from '../../../ai/utils/botRolePrompts';

const RULE_SNIPPETS = [
  { label: 'Strict TypeScript', text: 'Enforce strict TypeScript: reject "any", require return types, verify exhaustive union checks.' },
  { label: 'Security & OWASP', text: 'Sanitize external inputs against SQLi/XSS, verify auth tokens on mutation endpoints, no secrets in logs.' },
  { label: 'Performance', text: 'Flag potential N+1 database queries, verify pagination on large listings, check for redundant re-renders.' },
  { label: 'Clean Architecture', text: 'Enforce SOLID principles, keep business domain decoupled from transport/DB, no circular imports.' },
  { label: 'Unit Test Coverage', text: 'Ensure every new feature or bug fix includes corresponding automated tests with edge assertions.' },
];

export const RepositoryAgentsTab: React.FC<{
  inheritAgents: boolean;
  setInheritAgents: (inherit: boolean) => void;
  customRules: string;
  setCustomRules: React.Dispatch<React.SetStateAction<string>>;
  onClose: () => void;
}> = ({
  inheritAgents,
  setInheritAgents,
  customRules,
  setCustomRules,
  onClose,
}) => {
  const { currentRepo, showToast } = useGitStore();
  const { setIsPreferencesOpen } = usePreferencesStore();
  const externalAgents = useAiMcpStore((state) => state.externalAgents);
  const {
    globalReviewers,
    repoActiveBotIds,
    repoCustomReviewers,
    toggleRepoActiveBotId,
    addRepoCustomReviewer,
    deleteRepoCustomReviewer,
    resetRepoToGlobal,
  } = useBotReviewersStore();

  const [isAddingRepoBot, setIsAddingRepoBot] = useState(false);
  const [repoBotName, setRepoBotName] = useState('');
  const [repoBotTagline, setRepoBotTagline] = useState('');
  const [repoBotDesc, setRepoBotDesc] = useState('');
  const [repoBotCategory, setRepoBotCategory] = useState<BotCategory>('custom');
  const [repoBotEmoji, setRepoBotEmoji] = useState('🤖');
  const [repoBotInstructions, setRepoBotInstructions] = useState('');
  const [repoBotExecutionMode, setRepoBotExecutionMode] = useState<'provider' | 'acp'>('provider');
  const [repoBotAcpAgentId, setRepoBotAcpAgentId] = useState('');
  const [repoBotAllowAcpSourceTransfer, setRepoBotAllowAcpSourceTransfer] = useState(false);
  const [repoBotAcpConfigOptions, setRepoBotAcpConfigOptions] = useState<AcpReviewConfigOverrides>({});

  const currentRepoId = currentRepo?.id || '';

  const activeBotSet = useMemo(() => {
    const list = repoActiveBotIds[currentRepoId] ?? globalReviewers.filter((b) => b.enabled).map((b) => b.id);
    return new Set(list);
  }, [repoActiveBotIds, currentRepoId, globalReviewers]);

  const repoExclusiveBots = repoCustomReviewers[currentRepoId] || [];

  const handleAppendSnippet = (text: string) => {
    setCustomRules((prev) => (prev.trim() ? `${prev.trim()}\n\n- ${text}` : `- ${text}`));
  };

  const handleSaveRepoCustomBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoBotName.trim() || !currentRepoId) return;
    if (repoBotExecutionMode === 'acp' && !externalAgents.some((agent) => agent.id === repoBotAcpAgentId)) {
      showToast('Choose an installed ACP agent first.');
      return;
    }

    addRepoCustomReviewer(currentRepoId, {
      name: repoBotName.trim(),
      tagline: repoBotTagline.trim(),
      description: repoBotDesc.trim(),
      category: repoBotCategory,
      avatarEmoji: repoBotEmoji,
      customInstructions: repoBotInstructions.trim(),
      provider: repoBotExecutionMode === 'acp' ? 'global_default' : undefined,
      model: repoBotExecutionMode === 'acp' ? 'global_default' : undefined,
      acpAgentId: repoBotExecutionMode === 'acp' ? repoBotAcpAgentId : undefined,
      allowAcpSourceTransfer: repoBotExecutionMode === 'acp' ? repoBotAllowAcpSourceTransfer : undefined,
      acpConfigOptions: repoBotExecutionMode === 'acp' ? repoBotAcpConfigOptions : undefined,
      enabled: true,
      isBuiltin: false,
    });

    setIsAddingRepoBot(false);
    setRepoBotName('');
    setRepoBotTagline('');
    setRepoBotDesc('');
    setRepoBotCategory('custom');
    setRepoBotEmoji('🤖');
    setRepoBotInstructions('');
    setRepoBotExecutionMode('provider');
    setRepoBotAcpAgentId('');
    setRepoBotAllowAcpSourceTransfer(false);
    setRepoBotAcpConfigOptions({});
    showToast(`Added repo reviewer: ${repoBotName.trim()}`);
  };

  const repoBotCategoryOptions: CustomSelectOption<BotCategory>[] = BOT_CATEGORIES.map(
    (category) => ({ value: category.id, label: category.label })
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[1rem] text-text font-medium flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-brand" />
          <span>Repository Bot Reviewers</span>
        </h3>
        <p className="text-xs text-subtext0 mt-0.5">
          Configure which AI Reviewer bots analyze Virtual MRs, catch security vulnerabilities, and inspect code for this repository.
        </p>
      </div>

      {/* INHERITANCE MODE SELECTOR CARDS */}
      <div className="grid grid-cols-2 gap-3">
        {/* Option 1: Inherit Global (Default) */}
        <div
          onClick={() => setInheritAgents(true)}
          className={`p-3.5 border cursor-pointer transition-all flex flex-col justify-between ${
            inheritAgents
              ? 'bg-brand/5 border-brand/60 shadow-xs'
              : 'bg-crust border-surface0 hover:border-surface1 opacity-80'
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="reviewer-inheritance"
                  checked={inheritAgents}
                  onChange={() => setInheritAgents(true)}
                  className="text-brand focus:ring-0 cursor-pointer"
                />
                <span className="font-semibold text-xs text-text">
                  Inherit Global Preferences
                </span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-brand/20 text-brand border border-brand/30">
                Default
              </span>
            </div>
            <p className="text-[11px] text-subtext0 leading-relaxed pl-5">
              Automatically inherits all active Bot Reviewers and AI model settings configured in App Preferences.
            </p>
          </div>

          <div className="pt-2 mt-2 border-t border-surface0/60 pl-5 flex items-center justify-between">
            <span className="text-[11px] text-brand font-medium">
              {globalReviewers.filter((b) => b.enabled).length} global bots active
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                setIsPreferencesOpen(true);
              }}
              className="text-[11px] text-subtext0 hover:text-text flex items-center gap-1 cursor-pointer hover:underline"
              title="Open App Preferences modal"
            >
              <span>Open Preferences</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Option 2: Custom for this Repo */}
        <div
          onClick={() => setInheritAgents(false)}
          className={`p-3.5 border cursor-pointer transition-all flex flex-col justify-between ${
            !inheritAgents
              ? 'bg-accent/5 border-accent/60 shadow-xs'
              : 'bg-crust border-surface0 hover:border-surface1 opacity-80'
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="reviewer-inheritance"
                  checked={!inheritAgents}
                  onChange={() => setInheritAgents(false)}
                  className="text-accent focus:ring-0 cursor-pointer"
                />
                <span className="font-semibold text-xs text-text">
                  Custom for this Repository
                </span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-surface1 text-subtext0 border border-surface2">
                Isolated
              </span>
            </div>
            <p className="text-[11px] text-subtext0 leading-relaxed pl-5">
              Override active bots independently for this repository, or add repository-exclusive custom reviewer bots.
            </p>
          </div>

          <div className="pt-2 mt-2 border-t border-surface0/60 pl-5 flex items-center justify-between">
            <span className="text-[11px] text-accent font-medium">
              {activeBotSet.size} bots enabled for repo
            </span>
            {!inheritAgents && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resetRepoToGlobal(currentRepoId);
                  showToast('Reset bot selections to global defaults');
                }}
                className="text-[11px] text-subtext0 hover:text-text flex items-center gap-1 cursor-pointer"
                title="Reset to global active selection"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BOT ROSTER DISPLAY */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-text flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-subtext0" />
            <span>
              {inheritAgents
                ? 'Inherited Reviewer Bots (Read-only)'
                : 'Repository Reviewer Selection (Custom)'}
            </span>
          </span>

          {!inheritAgents && (
            <button
              type="button"
              onClick={() => setIsAddingRepoBot(true)}
              className="flex items-center gap-1 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-text text-xs transition-colors cursor-pointer border border-surface2/40"
            >
              <Plus className="w-3 h-3" />
              <span>Add Repo Bot</span>
            </button>
          )}
        </div>

        {/* FORM TO ADD REPO-EXCLUSIVE CUSTOM BOT */}
        {isAddingRepoBot && !inheritAgents && (
          <form
            onSubmit={handleSaveRepoCustomBot}
            className="p-4 bg-crust border border-accent/40 space-y-3 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-text flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-accent" />
                <span>Create Repo-Exclusive Reviewer Bot</span>
              </span>
              <button
                type="button"
                onClick={() => setIsAddingRepoBot(false)}
                className="text-subtext0 hover:text-text cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1">
                <label className="block text-[10px] text-subtext0 mb-1">Emoji</label>
                <input
                  type="text"
                  maxLength={4}
                  value={repoBotEmoji}
                  onChange={(e) => setRepoBotEmoji(e.target.value)}
                  className="w-12 h-8 text-center text-[1rem] bg-surface0 border border-surface1 text-text"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-[10px] text-subtext0 mb-1">Bot Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Migration Linter"
                  value={repoBotName}
                  onChange={(e) => setRepoBotName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 text-xs text-text"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-subtext0 mb-1">Tagline</label>
                <input
                  type="text"
                  placeholder="e.g. Database schema backwards compatibility"
                  value={repoBotTagline}
                  onChange={(e) => setRepoBotTagline(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 text-xs text-text"
                />
              </div>
              <div>
                <label className="block text-[10px] text-subtext0 mb-1">Role</label>
                <CustomSelect
                  value={repoBotCategory}
                  options={repoBotCategoryOptions}
                  onChange={setRepoBotCategory}
                  className="w-full"
                  buttonClassName="w-full"
                  dropdownWidth="w-full"
                  align="left"
                  aria-label="Reviewer role"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-subtext0 mb-1">Execution engine</label>
                <CustomSelect
                  value={repoBotExecutionMode}
                  options={[
                    { value: 'provider', label: 'Global LLM provider' },
                    { value: 'acp', label: 'ACP Agent' },
                  ]}
                  onChange={(mode) => {
                    setRepoBotExecutionMode(mode as 'provider' | 'acp');
                    if (mode === 'acp' && !repoBotAcpAgentId) setRepoBotAcpAgentId(externalAgents[0]?.id || '');
                  }}
                  className="w-full"
                  buttonClassName="w-full"
                  dropdownWidth="w-full"
                  align="left"
                  aria-label="Repository reviewer execution engine"
                />
              </div>
              {repoBotExecutionMode === 'acp' && <div>
                <label className="block text-[10px] text-subtext0 mb-1">Installed ACP agent</label>
                {externalAgents.length > 0 ? <CustomSelect
                  value={repoBotAcpAgentId}
                  options={externalAgents.map((agent) => ({
                    value: agent.id,
                    label: `${agent.name}${agent.version ? ` · ${agent.version}` : ''}`,
                    description: agent.description || agent.source,
                  }))}
                  onChange={(agentId) => {
                    setRepoBotAcpAgentId(agentId);
                    setRepoBotAcpConfigOptions({});
                  }}
                  searchable
                  searchPlaceholder="Search installed agents…"
                  className="w-full"
                  buttonClassName="w-full"
                  dropdownWidth="w-full"
                  align="left"
                  aria-label="Repository ACP reviewer agent"
                /> : <p className="border border-yellow/40 bg-yellow/5 p-2 text-[10px] text-yellow">Install an agent in AI Preferences → External Agents first.</p>}
              </div>}
            </div>

            {repoBotExecutionMode === 'acp' && <AcpReviewerConfigOptions
              agent={externalAgents.find((agent) => agent.id === repoBotAcpAgentId)}
              value={repoBotAcpConfigOptions}
              onChange={setRepoBotAcpConfigOptions}
            />}

            {repoBotExecutionMode === 'acp' && <div className="space-y-2 border border-surface0 bg-surface0/20 p-2.5">
              <label className="flex items-start gap-2 text-[10px] text-subtext0">
                <input type="checkbox" checked={repoBotAllowAcpSourceTransfer} onChange={(event) => setRepoBotAllowAcpSourceTransfer(event.target.checked)} className="mt-0.5 accent-accent" />
                <span>I allow this ACP agent to receive eligible changed-file diffs and review context. Sensitive paths are excluded and matching secret lines are redacted, but detection cannot catch every secret. This consent is used for automatic reviews assigned to this bot.</span>
              </label>
              <p className="text-[10px] text-subtext0">Stage0 validates tool requests and finding evidence; the agent runs outside the repository directory.</p>
            </div>}

            <div>
              <label className="block text-[10px] text-subtext0 mb-1">
                Stage0 System Prompt · {BOT_CATEGORIES.find((category) => category.id === repoBotCategory)?.label} · read-only
              </label>
              <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap px-2.5 py-1.5 bg-crust border border-surface1 text-[10px] font-mono text-subtext1">
                {getBotRolePrompt(repoBotCategory)}
              </pre>
              <label className="block text-[10px] text-subtext0 mb-1 mt-2">
                Additional Instructions <span className="font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={repoBotInstructions}
                onChange={(e) => setRepoBotInstructions(e.target.value)}
                placeholder="Add bot-specific review guidance for this repository..."
                className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 text-xs font-mono text-text"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingRepoBot(false)}
                className="px-3 py-1 bg-surface0 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1 bg-accent text-on-accent font-semibold text-xs cursor-pointer shadow-xs"
              >
                Save Bot
              </button>
            </div>
          </form>
        )}

        {/* CARDS GRID */}
        <div className="grid grid-cols-2 gap-3">
          {/* INHERITED MODE: Show all enabled global bots */}
          {inheritAgents &&
            globalReviewers
              .filter((b) => b.enabled)
              .map((bot) => (
                <div
                  key={bot.id}
                  className="p-3 bg-crust border border-surface0 space-y-2 flex flex-col justify-between hover:border-surface1 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl p-1 bg-surface0">{bot.avatarEmoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-text truncate">
                            {bot.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-brand/10 text-brand border border-brand/20">
                            Global
                          </span>
                        </div>
                        <span className="text-[10px] text-subtext0 font-mono truncate block">
                          {bot.tagline}
                        </span>
                        <span className="text-[10px] text-accent font-mono truncate block">
                          {bot.acpAgentId ? `ACP · ${externalAgents.find((agent) => agent.id === bot.acpAgentId)?.name || 'Agent unavailable'}${bot.allowAcpSourceTransfer ? '' : ' · source consent required'}` : 'Built-in LLM provider'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-subtext0 line-clamp-2 mt-1">
                      {bot.description}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-surface0/60 flex items-center justify-between text-[11px]">
                    <span className="text-brand flex items-center gap-1 font-mono font-medium">
                      <Check className="w-3 h-3 text-brand" /> Active in MRs
                    </span>
                    <span className="text-subtext1 capitalize font-mono text-[10px]">
                      {bot.category}
                    </span>
                  </div>
                </div>
              ))}

          {/* CUSTOM MODE: Show global + repo custom bots with checkbox toggles */}
          {!inheritAgents &&
            [...globalReviewers, ...repoExclusiveBots].map((bot) => {
              const isChecked = activeBotSet.has(bot.id);
              const isRepoExclusive = repoExclusiveBots.some((b) => b.id === bot.id);

              return (
                <div
                  key={bot.id}
                  onClick={() => toggleRepoActiveBotId(currentRepoId, bot.id)}
                  className={`p-3 border space-y-2 flex flex-col justify-between cursor-pointer transition-all ${
                    isChecked
                      ? 'bg-surface0/30 border-surface1 shadow-xs'
                      : 'bg-crust border-surface0/50 opacity-60'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRepoActiveBotId(currentRepoId, bot.id)}
                        className="border-surface1 text-accent focus:ring-0 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xl p-1 bg-surface0">{bot.avatarEmoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-text truncate">
                            {bot.name}
                          </span>
                          {isRepoExclusive ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-accent/20 text-accent border border-accent/30">
                              Repo Custom
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-surface1 text-subtext0">
                              Global
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-subtext0 font-mono truncate block">
                          {bot.tagline}
                        </span>
                        <span className="text-[10px] text-accent font-mono truncate block">
                          {bot.acpAgentId ? `ACP · ${externalAgents.find((agent) => agent.id === bot.acpAgentId)?.name || 'Agent unavailable'}${bot.allowAcpSourceTransfer ? '' : ' · source consent required'}` : 'Built-in LLM provider'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-subtext0 line-clamp-2 mt-1">
                      {bot.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-surface0/60 flex items-center justify-between text-[11px]">
                    <span
                      className={`flex items-center gap-1 font-mono text-[10px] ${
                        isChecked ? 'text-accent font-medium' : 'text-subtext0'
                      }`}
                    >
                      {isChecked ? '✓ Enabled for repo' : 'Disabled for repo'}
                    </span>
                    {isRepoExclusive && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRepoCustomReviewer(currentRepoId, bot.id);
                        }}
                        className="text-subtext0 hover:text-red-400 p-0.5 cursor-pointer"
                        title="Delete repo-exclusive bot"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* CUSTOM RULES FOR THIS REPOSITORY */}
      <div className="p-4 bg-crust border border-surface0 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" />
            <span className="font-semibold text-xs text-text">
              Custom Repository Instructions &amp; Rules
            </span>
          </div>
          <span className="text-[10px] text-subtext0 font-mono">
            Appended to bot reviewer prompts for this repo
          </span>
        </div>

        <p className="text-xs text-subtext0">
          Add project-specific coding standards, architecture constraints, or framework conventions. These directives apply to all active reviewers when evaluating Virtual MRs in this repository.
        </p>

        {/* QUICK SNIPPETS PILLS */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[10px] uppercase font-bold text-subtext0/70 mr-1">
            Quick Snippets:
          </span>
          {RULE_SNIPPETS.map((snip) => (
            <button
              key={snip.label}
              type="button"
              onClick={() => handleAppendSnippet(snip.text)}
              className="px-2 py-0.5 bg-surface0 hover:bg-surface1 text-subtext0 hover:text-text text-[11px] transition-colors cursor-pointer border border-surface1"
              title={snip.text}
            >
              + {snip.label}
            </button>
          ))}
        </div>

        <textarea
          rows={4}
          value={customRules}
          onChange={(e) => setCustomRules(e.target.value)}
          placeholder="e.g. This project requires strict TypeScript without 'any'; verify Prisma query transactions; all exported APIs must include JSDoc comments..."
          className="w-full px-3 py-2 bg-surface0 border border-surface1 text-text text-xs font-mono focus:outline-none focus:border-brand leading-relaxed"
        />
      </div>
    </div>
  );
};

