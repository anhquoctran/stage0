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
        description={translateUiText('preferences.aiOverview.providersDescription')}
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-providers')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>{translateUiText('preferences.aiOverview.configure')}</span>
          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.nav.ai-external-agents')}
        description={translateUiText('preferences.aiOverview.externalAgentsDescription')}
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-external-agents')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>{translateUiText('preferences.aiOverview.configure')}</span>
          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.nav.ai-reviewers')}
        description={translateUiText('preferences.aiOverview.reviewersDescription')}
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-reviewers')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>{translateUiText('preferences.aiOverview.configure')}</span>
          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.nav.ai-mcp')}
        description={translateUiText('preferences.aiOverview.mcpDescription')}
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-mcp')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>{translateUiText('preferences.aiOverview.configure')}</span>
          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </SettingRow>

      <div className="pt-4 pb-1">
        <div className="text-xs font-semibold text-subtext1">{translateUiText('preferences.aiOverview.agentConfiguration')}</div>
      </div>

      <SettingRow
        title={translateUiText('preferences.aiOverview.skills')}
        description={translateUiText('preferences.aiOverview.skillsDescription')}
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-mcp')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>{translateUiText('preferences.aiOverview.configure')}</span>
          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.nav.ai-sandbox')}
        description={translateUiText('preferences.aiOverview.sandboxDescription')}
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-sandbox')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>{translateUiText('preferences.aiOverview.configure')}</span>
          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.aiOverview.toolPermissions')}
        description={translateUiText('preferences.aiOverview.toolPermissionsDescription')}
      >
        <button
          type="button"
          onClick={() => setActiveTab('ai-guardrails')}
          className="px-3 py-1.5 bg-surface0/60 hover:bg-surface0 border border-surface1/40 hover:border-surface2 text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium rounded-sm"
        >
          <span>{translateUiText('preferences.aiOverview.configure')}</span>
          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.aiOverview.singleFileReview')}
        description={translateUiText('preferences.aiOverview.singleFileReviewDescription')}
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
        title={translateUiText('preferences.aiOverview.streamResponses')}
        description={translateUiText('preferences.aiOverview.streamResponsesDescription')}
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

