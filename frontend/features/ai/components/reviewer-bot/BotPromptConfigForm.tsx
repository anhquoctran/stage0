import { BOT_CATEGORIES } from '../../constants/botPresets';
import { getBotRolePrompt } from '../../utils/botRolePrompts';
import type { BotPromptConfigFormProps } from './BotPromptConfigFormProps';

export function BotPromptConfigForm({
  formCategory,
  formInstructions,
  setFormInstructions,
}: BotPromptConfigFormProps) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[11px] font-semibold text-subtext0">
          {t('ai.reviewerBotConfig.systemPrompt')} ·{' '}
          {BOT_CATEGORIES.find((category) => category.id === formCategory)?.label}
        </label>
        <span className="text-[10px] text-subtext0 font-mono">{t('ai.reviewerBotConfig.readOnlyByRole')}</span>
      </div>
      <pre
        key={formCategory}
        tabIndex={0}
        aria-label={t('ai.reviewerBotConfig.systemPrompt')}
        className="w-full max-h-36 overflow-y-auto overscroll-contain whitespace-pre-wrap px-3 py-2 bg-crust border border-surface1 text-xs font-mono text-subtext1 leading-relaxed select-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        {getBotRolePrompt(formCategory)}
      </pre>
      <label className="block text-[11px] font-semibold text-subtext0 mt-3 mb-1">
        {t('ai.reviewerBotConfig.additionalInstructions')} <span className="font-normal">({t('common.optional')})</span>
      </label>
      <textarea
        rows={5}
        value={formInstructions}
        onChange={(e) => setFormInstructions(e.target.value)}
        placeholder={t('ai.reviewerBotConfig.instructionsPlaceholder')}
        className="w-full px-3 py-2 bg-surface0 border border-surface1 text-xs font-mono text-text focus:outline-none focus:border-brand leading-relaxed rounded-sm"
      />
    </div>
  );
}
import { useTranslation } from 'react-i18next';
