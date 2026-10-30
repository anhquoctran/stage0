import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { PROMPT_ROLE_OPTIONS } from '../constants/aiMcpConstants';
import { getBotRolePrompt } from '../utils/botRolePrompts';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';

export const AiMcpPromptRolesView: React.FC<{
  reviewerInstructions?: string;
  onUpdateReviewerInstructions: (instructions: string) => void;
}> = ({ reviewerInstructions = '', onUpdateReviewerInstructions }) => {
  const { t } = useTranslation();
  const [promptPreviewRole, setPromptPreviewRole] = useState<BotCategory>('custom');

  return (
    <div className="space-y-4 animate-in fade-in duration-100">
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-text">{t('ai.mcpPrompts.title')}</h3>
          <p className="text-[11px] text-subtext0 mt-1">
            {t('ai.mcpPrompts.description')}
          </p>
        </div>
        <div className="max-w-sm">
          <label className="block text-[11px] font-semibold text-subtext0 mb-1">{t('ai.mcpPrompts.previewRole')}</label>
          <CustomSelect
            value={promptPreviewRole}
            options={PROMPT_ROLE_OPTIONS}
            onChange={setPromptPreviewRole}
            className="w-full"
            buttonClassName="w-full"
            dropdownWidth="w-full"
            align="left"
            aria-label={t('ai.mcpPrompts.previewAriaLabel')}
          />
        </div>
        <pre className="w-full max-h-[28rem] overflow-y-auto whitespace-pre-wrap p-3 bg-base border border-surface1 text-xs text-subtext1 font-mono leading-relaxed select-text">
          {getBotRolePrompt(promptPreviewRole)}
        </pre>
        <div>
          <label className="block text-[11px] font-semibold text-subtext0 mb-1">
            {t('ai.mcpPrompts.additionalInstructions')} <span className="font-normal">({t('common.optional')})</span>
          </label>
          <p className="text-[10px] text-subtext0 mb-2">
            {t('ai.mcpPrompts.additionalInstructionsDescription')}
          </p>
          <textarea
            rows={5}
            value={reviewerInstructions}
            onChange={(event) => onUpdateReviewerInstructions(event.target.value)}
            placeholder={t('ai.mcpPrompts.additionalInstructionsPlaceholder')}
            className="w-full p-3 bg-base border border-surface1 text-xs text-text font-mono leading-relaxed placeholder:text-subtext0 focus:outline-none focus:border-surface2 select-text rounded-sm"
          />
        </div>
      </div>
    </div>
  );
};
