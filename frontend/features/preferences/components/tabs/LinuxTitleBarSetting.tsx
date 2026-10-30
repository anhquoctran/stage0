import { CustomSelect } from '../../../../common/components/CustomSelect';
import { useTranslation } from 'react-i18next';
import { useWindowChromeStore } from '../../../../core/store/useWindowChromeStore';
import type { LinuxTitleBarMode } from '../../../../core/types/LinuxTitleBarMode';
import { SettingRow } from '../SettingRow';

export function LinuxTitleBarSetting({ value, onChange }: {
  value: LinuxTitleBarMode;
  onChange: (value: LinuxTitleBarMode) => void;
}) {
  const { t } = useTranslation();
  const profile = useWindowChromeStore((state) => state.profile);
  if (profile.platform !== 'linux') return null;
  const desktop = { gnome: 'GNOME', kde: 'KDE Plasma', xfce: 'Xfce', unknown: 'Linux desktop' }[profile.desktop];
  return <SettingRow title={t('preferences.linuxTitleBar.title')} description={t('preferences.linuxTitleBar.description', { desktop })}>
    <CustomSelect<LinuxTitleBarMode>
      value={value}
      onChange={onChange}
      options={[{ value: 'system', label: t('preferences.linuxTitleBar.system') }, { value: 'custom', label: t('preferences.linuxTitleBar.custom') }]}
      aria-label={t('preferences.linuxTitleBar.ariaLabel')}
    />
  </SettingRow>;
}
