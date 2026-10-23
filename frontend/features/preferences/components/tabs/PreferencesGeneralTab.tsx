import React from 'react';
import { SettingRow } from '../SettingRow';
import { ZedSwitch } from '../ZedSwitch';
import { useCommandShortcut } from '../../../../core/hooks/useCommandShortcut';
import type { AiConfig } from '../../../ai/types/AiConfig';

export const PreferencesGeneralTab: React.FC<{
  draftShowInlineBlame: boolean;
  setDraftShowInlineBlame: (val: boolean) => void;
  draftAiConfig: AiConfig;
  setDraftAiConfig: (next: AiConfig | ((prev: AiConfig) => AiConfig)) => void;
  showToast: (msg: string) => void;
}> = ({
  draftShowInlineBlame,
  setDraftShowInlineBlame,
  draftAiConfig,
  setDraftAiConfig,
  showToast,
}) => {
  const { title: commandTitle } = useCommandShortcut();
  return (
    <div className="space-y-1">
      <SettingRow
        title="Inline Git Blame"
        description={commandTitle('toggle_inline_blame',
          'Show commit author, relative time, and summary annotation at the end of the active line in diff view.'
        )}
      >
        <ZedSwitch
          checked={draftShowInlineBlame}
          onChange={setDraftShowInlineBlame}
        />
      </SettingRow>

      <SettingRow
        title="Stream AI Responses"
        description="Stream token-by-token completion for real-time responsiveness when generating summaries and reviews."
      >
        <ZedSwitch
          checked={draftAiConfig.streamResponse}
          onChange={(val) =>
            setDraftAiConfig((prev) => ({ ...prev, streamResponse: val }))
          }
        />
      </SettingRow>

      <SettingRow
        title="AI Code Review Assistance"
        description="Enable proactive code review suggestions, inline risk detection, and automated MR annotations."
      >
        <ZedSwitch
          checked={draftAiConfig.enableCodeReviewAssist}
          onChange={(val) =>
            setDraftAiConfig((prev) => ({
              ...prev,
              enableCodeReviewAssist: val,
            }))
          }
        />
      </SettingRow>

      <SettingRow
        title="Accessibility & Contrast"
        description="Enhance focus rings, contrast boundaries, and text legibility across all editor panels."
      >
        <ZedSwitch
          checked={false}
          onChange={() =>
            showToast('High contrast mode is currently aligned with OS settings.')
          }
        />
      </SettingRow>
    </div>
  );
};
