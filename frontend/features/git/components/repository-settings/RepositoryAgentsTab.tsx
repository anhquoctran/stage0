import React, { useMemo } from 'react';
import { Check } from '../../../../common/components/icons/Check';
import { Plus } from '../../../../common/components/icons/Plus';
import { Shield } from '../../../../common/components/icons/Shield';
import { ShieldCheck } from '../../../../common/components/icons/ShieldCheck';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import { BOT_CATEGORIES } from '../../../ai/constants/botPresets';
import { useAiMcpStore } from '../../../ai/store/useAiMcpStore';
import { useBotReviewersStore } from '../../../ai/store/useBotReviewersStore';
import { usePreferencesStore } from '../../../preferences/store/usePreferencesStore';
import type { BotCategory } from '../../../virtual-mr/types/BotCategory';
import { useGitStore } from '../../store/useGitStore';
import { RepositoryBotInheritanceCards } from './RepositoryBotInheritanceCards';
import { RepositoryBotItem } from './RepositoryBotItem';
import { RepositoryCustomBotForm } from './RepositoryCustomBotForm';
import { RepositoryCustomRulesSection } from './RepositoryCustomRulesSection';
import { useRepositoryBotForm } from './useRepositoryBotForm';

const RULE_SNIPPETS = [
  {
    label: 'Strict TypeScript',
    text: 'Enforce strict TypeScript: reject "any", require return types, verify exhaustive union checks.',
  },
  {
    label: 'Security & OWASP',
    text: 'Sanitize external inputs against SQLi/XSS, verify auth tokens on mutation endpoints, no secrets in logs.',
  },
  {
    label: 'Performance',
    text: 'Flag potential N+1 database queries, verify pagination on large listings, check for redundant re-renders.',
  },
  {
    label: 'Clean Architecture',
    text: 'Enforce SOLID principles, keep business domain decoupled from transport/DB, no circular imports.',
  },
  {
    label: 'Unit Test Coverage',
    text: 'Ensure every new feature or bug fix includes corresponding automated tests with edge assertions.',
  },
];

export const RepositoryAgentsTab: React.FC<{
  inheritAgents: boolean;
  setInheritAgents: (inherit: boolean) => void;
  customRules: string;
  setCustomRules: React.Dispatch<React.SetStateAction<string>>;
  onClose: () => void;
}> = ({ inheritAgents, setInheritAgents, customRules, setCustomRules, onClose }) => {
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

  const currentRepoId = currentRepo?.id || '';

  const activeBotSet = useMemo(() => {
    const list =
      repoActiveBotIds[currentRepoId] ?? globalReviewers.filter((b) => b.enabled).map((b) => b.id);
    return new Set(list);
  }, [repoActiveBotIds, currentRepoId, globalReviewers]);

  const repoExclusiveBots = repoCustomReviewers[currentRepoId] || [];

  const handleAppendSnippet = (text: string) => {
    setCustomRules((prev) => (prev.trim() ? `${prev.trim()}\n\n- ${text}` : `- ${text}`));
  };

  const {
    setIsAddingRepoBot,
    isAddingRepoBot,
    handleSaveRepoCustomBot,
    repoBotEmoji,
    setRepoBotEmoji,
    repoBotName,
    setRepoBotName,
    repoBotTagline,
    setRepoBotTagline,
    repoBotCategory,
    setRepoBotCategory,
    repoBotExecutionMode,
    setRepoBotExecutionMode,
    repoBotAcpAgentId,
    setRepoBotAcpAgentId,
    setRepoBotAcpConfigOptions,
    repoBotAcpConfigOptions,
    repoBotAllowAcpSourceTransfer,
    setRepoBotAllowAcpSourceTransfer,
    repoBotInstructions,
    setRepoBotInstructions,
  } = useRepositoryBotForm({ currentRepoId, externalAgents, showToast, addRepoCustomReviewer });

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
          Configure which AI Reviewer bots analyze Virtual MRs, catch security vulnerabilities, and
          inspect code for this repository.
        </p>
      </div>

      {/* INHERITANCE MODE SELECTOR CARDS */}
      <RepositoryBotInheritanceCards
        setInheritAgents={setInheritAgents}
        inheritAgents={inheritAgents}
        globalReviewers={globalReviewers}
        onClose={onClose}
        setIsPreferencesOpen={setIsPreferencesOpen}
        activeBotSet={activeBotSet}
        resetRepoToGlobal={resetRepoToGlobal}
        currentRepoId={currentRepoId}
        showToast={showToast}
      />

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
          <RepositoryCustomBotForm
            handleSaveRepoCustomBot={handleSaveRepoCustomBot}
            setIsAddingRepoBot={setIsAddingRepoBot}
            repoBotEmoji={repoBotEmoji}
            setRepoBotEmoji={setRepoBotEmoji}
            repoBotName={repoBotName}
            setRepoBotName={setRepoBotName}
            repoBotTagline={repoBotTagline}
            setRepoBotTagline={setRepoBotTagline}
            repoBotCategory={repoBotCategory}
            repoBotCategoryOptions={repoBotCategoryOptions}
            setRepoBotCategory={setRepoBotCategory}
            repoBotExecutionMode={repoBotExecutionMode}
            setRepoBotExecutionMode={setRepoBotExecutionMode}
            repoBotAcpAgentId={repoBotAcpAgentId}
            setRepoBotAcpAgentId={setRepoBotAcpAgentId}
            externalAgents={externalAgents}
            setRepoBotAcpConfigOptions={setRepoBotAcpConfigOptions}
            repoBotAcpConfigOptions={repoBotAcpConfigOptions}
            repoBotAllowAcpSourceTransfer={repoBotAllowAcpSourceTransfer}
            setRepoBotAllowAcpSourceTransfer={setRepoBotAllowAcpSourceTransfer}
            repoBotInstructions={repoBotInstructions}
            setRepoBotInstructions={setRepoBotInstructions}
          />
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
                          {bot.acpAgentId
                            ? `ACP · ${externalAgents.find((agent) => agent.id === bot.acpAgentId)?.name || 'Agent unavailable'}${bot.allowAcpSourceTransfer ? '' : ' · source consent required'}`
                            : 'Built-in LLM provider'}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-subtext0 line-clamp-2 mt-1">{bot.description}</p>
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
                <RepositoryBotItem
                  key={bot.id}
                  bot={bot}
                  toggleRepoActiveBotId={toggleRepoActiveBotId}
                  currentRepoId={currentRepoId}
                  isChecked={isChecked}
                  isRepoExclusive={isRepoExclusive}
                  externalAgents={externalAgents}
                  deleteRepoCustomReviewer={deleteRepoCustomReviewer}
                />
              );
            })}
        </div>
      </div>

      {/* CUSTOM RULES FOR THIS REPOSITORY */}
      <RepositoryCustomRulesSection
        RULE_SNIPPETS={RULE_SNIPPETS}
        handleAppendSnippet={handleAppendSnippet}
        customRules={customRules}
        setCustomRules={setCustomRules}
      />
    </div>
  );
};
