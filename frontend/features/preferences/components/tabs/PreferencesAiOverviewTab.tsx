import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React from 'react';
import { SettingRow } from '../SettingRow';
import { ZedSwitch } from '../ZedSwitch';
import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import type { PreferenceTab } from '../../types/PreferenceTab';
import type { AiConfig } from '../../../ai/types/AiConfig';

export const PreferencesAiOverviewTab: React.FC<{
  setActiveTab: (tab: PreferenceTab) => void;
  draftAiConfig: AiConfig;
  setDraftAiConfig: (next: AiConfig | ((prev: AiConfig) => AiConfig)) => void;
}> = ({
  setActiveTab,
  draftAiConfig,
  setDraftAiConfig,
}) => {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div className="space-y-3">
      <SettingRow
        title={translateUiText('preferences.nav.ai-providers')}
        description="Configure natively-included model providers."
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-providers')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>Configure</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.nav.ai-external-agents')}
        description="View, add, and remove agents connected through the Agent Client Protocol."
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-external-agents')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>Configure</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.nav.ai-reviewers')}
        description="Configure review roles and their additional instructions."
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-reviewers')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>Configure</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.nav.ai-mcp')}
        description="View, add, configure, and remove Model Context Protocol servers."
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-mcp')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>Configure</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </SettingRow>

      {/* Subheader: Agent Configuration */}
      <div className="pt-4 pb-1">
        <div className="text-xs font-semibold text-subtext1">Agent Configuration</div>
      </div>

      <SettingRow
        title="Skills"
        description="View and manage agent skills installed globally or in project worktrees."
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-mcp')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>Configure</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.nav.ai-sandbox')}
        description="Review and change the elevated terminal sandbox permissions that are always allowed without prompting."
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-sandbox')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>Configure</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </SettingRow>

      <SettingRow
        title="Tool Permissions"
        description="Set up regex patterns to auto-allow, auto-deny, or always request confirmation, for specific tool inputs."
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-guardrails')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>Configure</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </SettingRow>

      <SettingRow
        title="Single File Review"
        description="When enabled, agent edits will also be displayed in single-file buffers for review."
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
        title="Stream AI Responses"
        description="Stream token-by-token completion for real-time responsiveness when generating summaries."
      >
        <ZedSwitch
          checked={draftAiConfig.streamResponse}
          onChange={(val) =>
            setDraftAiConfig((prev) => ({ ...prev, streamResponse: val }))
          }
        />
      </SettingRow>
    </div>
  );
};

