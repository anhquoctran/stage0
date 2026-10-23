import React, { useState } from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { PROMPT_ROLE_OPTIONS } from '../constants/aiMcpConstants';
import { getBotRolePrompt } from '../utils/botRolePrompts';
import type { BotCategory } from '../../virtual-mr/types/BotCategory';

export const AiMcpPromptRolesView: React.FC<{
  reviewerInstructions?: string;
  onUpdateReviewerInstructions: (instructions: string) => void;
}> = ({ reviewerInstructions = '', onUpdateReviewerInstructions }) => {
  const [promptPreviewRole, setPromptPreviewRole] = useState<BotCategory>('custom');

  return (
    <div className="space-y-4 animate-in fade-in duration-100">
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-text">Stage0 system prompts</h3>
          <p className="text-[11px] text-subtext0 mt-1">
            These role prompts are built into Stage0 and read-only. A reviewer bot selects one by role; custom bots can add separate instructions in the Reviewer Bots tab.
          </p>
        </div>
        <div className="max-w-sm">
          <label className="block text-[11px] font-semibold text-subtext0 mb-1">Preview role</label>
          <CustomSelect
            value={promptPreviewRole}
            options={PROMPT_ROLE_OPTIONS}
            onChange={setPromptPreviewRole}
            className="w-full"
            buttonClassName="w-full"
            dropdownWidth="w-full"
            align="left"
            aria-label="System prompt role preview"
          />
        </div>
        <pre className="w-full max-h-[28rem] overflow-y-auto whitespace-pre-wrap p-3 bg-base border border-surface1 text-xs text-subtext1 font-mono leading-relaxed select-text">
          {getBotRolePrompt(promptPreviewRole)}
        </pre>
        <div>
          <label className="block text-[11px] font-semibold text-subtext0 mb-1">
            Additional Instructions for Global AI Reviews <span className="font-normal">(optional)</span>
          </label>
          <p className="text-[10px] text-subtext0 mb-2">
            This text supplements the read-only General Reviewer prompt when a review uses Global AI Preferences. Reviewer bots keep their own instructions in the Reviewer Bots tab.
          </p>
          <textarea
            rows={5}
            value={reviewerInstructions}
            onChange={(event) => onUpdateReviewerInstructions(event.target.value)}
            placeholder="Add extra guidance for reviews started with Global AI Preferences..."
            className="w-full p-3 bg-base border border-surface1 text-xs text-text font-mono leading-relaxed placeholder:text-subtext0 focus:outline-none focus:border-surface2 select-text rounded-sm"
          />
        </div>
      </div>
    </div>
  );
};

