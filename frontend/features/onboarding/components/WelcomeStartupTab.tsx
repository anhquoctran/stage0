import React from 'react';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { SettingRow } from '../../preferences/components/SettingRow';
import { ZedSwitch } from '../../preferences/components/ZedSwitch';
import type { WelcomeSettingsProps } from '../types/WelcomeSettingsProps';

export const WelcomeStartupTab: React.FC<Omit<WelcomeSettingsProps, 'step'>> = ({ settings, onChange }) => {
  const canAddToPath = useApplicationServices().platform.capabilities.backend;
  return (
    <div className="space-y-1">
      <SettingRow
        title="Start Stage0 on system boot"
        description="Automatically launch Stage0 when you log in to your computer so it is ready for code reviews."
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
        title="Start in background"
        description="Keep Stage0 running quietly in the system tray on startup without opening a window until requested."
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
        title="Open repositories from the terminal"
        description={canAddToPath
          ? <>Add <code>stage0</code> to your user PATH. Start a new terminal, then run <code>stage0 [dir]</code> to open a repository.</>
          : 'Available in the Stage0 desktop app.'}
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
