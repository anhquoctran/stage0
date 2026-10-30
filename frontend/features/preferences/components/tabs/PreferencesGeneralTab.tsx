import type { LinuxTitleBarMode } from '../../../../core/types/LinuxTitleBarMode';
import { LinuxTitleBarSetting } from './LinuxTitleBarSetting';
import React from 'react';
import { SettingRow } from '../SettingRow';
import { ZedSwitch } from '../ZedSwitch';
import { useCommandShortcut } from '../../../../core/hooks/useCommandShortcut';
import { useApplicationServices } from '../../../../core/services/runtime/useApplicationServices';
import type { AiConfig } from '../../../ai/types/AiConfig';
import { Trans, useTranslation } from 'react-i18next';

export const PreferencesGeneralTab: React.FC<{
  draftShowInlineBlame: boolean;
  setDraftShowInlineBlame: (val: boolean) => void;
  draftLaunchAtStartup: boolean;
  setDraftLaunchAtStartup: (val: boolean) => void;
  draftStartInBackground: boolean;
  setDraftStartInBackground: (val: boolean) => void;
  draftExplorerContextMenu: boolean;
  setDraftExplorerContextMenu: (val: boolean) => void;
  draftLinuxTitleBar: LinuxTitleBarMode;
  setDraftLinuxTitleBar: (value: LinuxTitleBarMode) => void;
  draftAddToPath: boolean;
  setDraftAddToPath: (val: boolean) => void;
  draftAiConfig: AiConfig;
  setDraftAiConfig: (next: AiConfig | ((prev: AiConfig) => AiConfig)) => void;
  showToast: (msg: string) => void;
}> = ({
  draftShowInlineBlame,
  setDraftShowInlineBlame,
  draftLaunchAtStartup,
  setDraftLaunchAtStartup,
  draftStartInBackground,
  setDraftStartInBackground,
  draftExplorerContextMenu,
  setDraftExplorerContextMenu,
  draftAddToPath,
  draftLinuxTitleBar,
  setDraftLinuxTitleBar,
  setDraftAddToPath,
  draftAiConfig,
  setDraftAiConfig,
  showToast,
}) => {
  const { t } = useTranslation();
  const { title: commandTitle } = useCommandShortcut();
  const canAddToPath = useApplicationServices().platform.capabilities.backend;
  const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.platform || navigator.userAgent);
  return (
    <div className="space-y-1">
      <LinuxTitleBarSetting value={draftLinuxTitleBar} onChange={setDraftLinuxTitleBar} />
      <SettingRow
        title={t('preferences.general.startOnBoot')}
        description={t('preferences.general.startOnBootDescription')}
      >
        <ZedSwitch
          checked={draftLaunchAtStartup}
          onChange={setDraftLaunchAtStartup}
        />
      </SettingRow>

      <SettingRow
        title={t('preferences.general.startInBackground')}
        description={t('preferences.general.startInBackgroundDescription')}
      >
        <ZedSwitch
          checked={draftStartInBackground}
          onChange={setDraftStartInBackground}
        />
      </SettingRow>

      <SettingRow
        title={t('preferences.general.explorerContextMenu')}
        description={t('preferences.general.explorerContextMenuDescription')}
      >
        <ZedSwitch
          checked={draftExplorerContextMenu}
          disabled={!isWindows}
          onChange={(val) => {
            if (!isWindows) {
              showToast(t('preferences.general.explorerWindowsOnly'));
              return;
            }
            setDraftExplorerContextMenu(val);
          }}
        />
      </SettingRow>

      <SettingRow
        title={t('preferences.general.terminalCommand')}
        description={canAddToPath
          ? <Trans i18nKey="preferences.general.terminalPathDescription" components={{ command: <code />, usage: <code /> }} />
          : t('preferences.general.availableInDesktop')}
      >
        <ZedSwitch
          checked={draftAddToPath}
          disabled={!canAddToPath}
          onChange={setDraftAddToPath}
        />
      </SettingRow>

      <SettingRow
        title={t('preferences.general.inlineGitBlame')}
        description={commandTitle('toggle_inline_blame',
          t('preferences.general.inlineGitBlameDescription')
        )}
      >
        <ZedSwitch
          checked={draftShowInlineBlame}
          onChange={setDraftShowInlineBlame}
        />
      </SettingRow>

      <SettingRow
        title={t('preferences.general.streamAiResponses')}
        description={t('preferences.general.streamAiResponsesDescription')}
      >
        <ZedSwitch
          checked={draftAiConfig.streamResponse}
          onChange={(val) =>
            setDraftAiConfig((prev) => ({ ...prev, streamResponse: val }))
          }
        />
      </SettingRow>

      <SettingRow
        title={t('preferences.general.aiCodeReviewAssistance')}
        description={t('preferences.general.aiCodeReviewAssistanceDescription')}
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
        title={t('preferences.general.accessibilityContrast')}
        description={t('preferences.general.accessibilityContrastDescription')}
      >
        <ZedSwitch
          checked={false}
          onChange={() =>
            showToast(t('preferences.general.highContrastOsAligned'))
          }
        />
      </SettingRow>
    </div>
  );
};
