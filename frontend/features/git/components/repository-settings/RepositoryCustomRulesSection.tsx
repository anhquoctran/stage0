import { Sparkles } from '../../../../common/components/icons/Sparkles';
import type { RepositoryCustomRulesSectionProps } from './RepositoryCustomRulesSectionProps';

export function RepositoryCustomRulesSection({
  RULE_SNIPPETS,
  handleAppendSnippet,
  customRules,
  setCustomRules,
}: RepositoryCustomRulesSectionProps) {
  return (
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
        Add project-specific coding standards, architecture constraints, or framework conventions.
        These directives apply to all active reviewers when evaluating Virtual MRs in this
        repository.
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
  );
}
