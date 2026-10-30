import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { Sparkles } from '../../../../common/components/icons/Sparkles';
import type { RepositoryCustomRulesSectionProps } from './RepositoryCustomRulesSectionProps';

export function RepositoryCustomRulesSection({
  RULE_SNIPPETS,
  handleAppendSnippet,
  customRules,
  setCustomRules,
}: RepositoryCustomRulesSectionProps) {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div className="p-4 bg-crust border border-surface0 space-y-3 rounded-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand" />
          <span className="font-semibold text-xs text-text">
            {translateUiText('git.repositoryAgents.customInstructionsTitle')}
          </span>
        </div>
        <span className="text-[10px] text-subtext0 font-mono">
          {translateUiText('git.repositoryAgents.instructionsPromptNote')}
        </span>
      </div>

      <p className="text-xs text-subtext0">
        {translateUiText('git.repositoryAgents.customInstructionsDescription')}
      </p>

      {/* QUICK SNIPPETS PILLS */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1">
        <span className="text-[10px] uppercase font-bold text-subtext0/70 me-1">
          {translateUiText('git.repositoryAgents.quickSnippets')}
        </span>
        {RULE_SNIPPETS.map((snip) => (
          <button
            key={snip.label}
            type="button"
            onClick={() => handleAppendSnippet(snip.text)}
            className="px-2 py-0.5 bg-surface0 hover:bg-surface1 text-subtext0 hover:text-text text-[11px] transition-colors cursor-pointer border border-surface1 rounded-sm"
          >
            + {snip.label}
          </button>
        ))}
      </div>

      <textarea
        rows={4}
        value={customRules}
        onChange={(e) => setCustomRules(e.target.value)}
        placeholder={translateUiText('git.repositoryAgents.customInstructionsPlaceholder')}
        className="w-full px-3 py-2 bg-surface0 border border-surface1 text-text text-xs font-mono focus:outline-none focus:border-brand leading-relaxed rounded-sm"
      />
    </div>
  );
}
