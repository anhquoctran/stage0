import React from 'react';
import { Trans, useTranslation as useUiTextTranslation } from 'react-i18next';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { SettingRow } from '../../preferences/components/SettingRow';
import { ZedSwitch } from '../../preferences/components/ZedSwitch';
import type { WelcomeSettingsProps } from '../types/WelcomeSettingsProps';

export const WelcomeStartupTab: React.FC<Omit<WelcomeSettingsProps, 'step'>> = ({ settings, onChange }) => {
  const { t: translateUiText } = useUiTextTranslation();
  const canAddToPath = useApplicationServices().platform.capabilities.backend;
  return (
    <div className="space-y-1">
      <SettingRow
        title={translateUiText('onboarding.startup.launchAtStartup')}
        description={translateUiText('onboarding.startup.launchAtStartupDescription')}
      >
        <ZedSwitch
          id="onboarding-launch-at-startup"
          checked={settings.launchAtStartup}
          onChange={(val) =>
            onChange((prev) => ({ ...prev, launchAtStartup: val }))
          }
        />
      </SettingRow>

      <SettingRow
        title={translateUiText('onboarding.startup.startInBackground')}
        description={translateUiText('onboarding.startup.startInBackgroundDescription')}
      >
        <ZedSwitch
          id="onboarding-start-in-background"
          checked={settings.startInBackground}
          onChange={(val) =>
            onChange((prev) => ({ ...prev, startInBackground: val }))
          }
        />
      </SettingRow>

      <SettingRow
        title={translateUiText('onboarding.startup.openRepositoriesFromTerminal')}
        description={canAddToPath
          ? <Trans i18nKey="onboarding.startup.terminalCommandDescription" components={{ command: <code />, example: <code /> }} />
          : translateUiText('onboarding.startup.desktopAppOnly')}
        borderBottom={false}
      >
        <ZedSwitch
          id="onboarding-add-stage0-to-path"
          checked={settings.addToPath}
          disabled={!canAddToPath}
          onChange={(val) => onChange((prev) => ({ ...prev, addToPath: val }))}
        />
      </SettingRow>
    </div>
  );
};
