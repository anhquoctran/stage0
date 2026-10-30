import { useTranslation } from 'react-i18next';
import { KeymapPresetPicker } from '../../preferences/components/keymaps/KeymapPresetPicker';
import type { WelcomeSettingsProps } from '../types/WelcomeSettingsProps';
import { WelcomeThemePicker } from './WelcomeThemePicker';
import { WelcomeStartupTab } from './WelcomeStartupTab';

export function WelcomeSettingsPanel({ step, settings, onChange }: WelcomeSettingsProps) {
  const { t } = useTranslation();
  if (step === 'welcome') {
    return (
      <div className="space-y-6">
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-subtext0">
            {t('onboarding.welcomeSettings.theme')}
          </h2>
          <WelcomeThemePicker settings={settings} onChange={onChange} />
        </div>
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-subtext0">
            {t('onboarding.welcomeSettings.keymap')}
          </h2>
          <KeymapPresetPicker
            value={settings.keymap}
            onChange={(keymap) => onChange((previous) => ({ ...previous, keymap }))}
          />
        </div>
      </div>
    );
  }
  if (step === 'repository') {
    return <WelcomeStartupTab settings={settings} onChange={onChange} />;
  }
  return null;
}
