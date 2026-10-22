import { BOT_CATEGORIES } from '../../constants/botPresets';
import { getBotRolePrompt } from '../../utils/botRolePrompts';
import type { BotPromptConfigFormProps } from './BotPromptConfigFormProps';

export function BotPromptConfigForm({
  formCategory,
  formInstructions,
  setFormInstructions,
}: BotPromptConfigFormProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[11px] font-semibold text-subtext0">
          Stage0 System Prompt ·{' '}
          {BOT_CATEGORIES.find((category) => category.id === formCategory)?.label}
        </label>
        <span className="text-[10px] text-subtext0 font-mono">Read-only · selected by role</span>
      </div>
      <pre className="w-full max-h-36 overflow-y-auto whitespace-pre-wrap px-3 py-2 bg-crust border border-surface1 text-xs font-mono text-subtext1 leading-relaxed select-text">
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
        className="w-full px-3 py-2 bg-surface0 border border-surface1 text-xs font-mono text-text focus:outline-none focus:border-brand leading-relaxed"
      />
    </div>
  );
}
