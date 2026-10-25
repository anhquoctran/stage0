import { CustomSelect } from '../../../../common/components/CustomSelect';
import { useWindowChromeStore } from '../../../../core/store/useWindowChromeStore';
import type { LinuxTitleBarMode } from '../../../../core/types/LinuxTitleBarMode';
import { SettingRow } from '../SettingRow';

export function LinuxTitleBarSetting({ value, onChange }: {
  value: LinuxTitleBarMode;
  onChange: (value: LinuxTitleBarMode) => void;
}) {
  const profile = useWindowChromeStore((state) => state.profile);
  if (profile.platform !== 'linux') return null;
  const desktop = { gnome: 'GNOME', kde: 'KDE Plasma', xfce: 'Xfce', unknown: 'Linux desktop' }[profile.desktop];
  return <SettingRow title="Window title bar" description={`System uses your desktop’s window frame and theme. Stage0 uses a custom frame with your desktop’s supported button layout. Detected: ${desktop}. Restart Stage0 after applying a change.`}>
    <CustomSelect<LinuxTitleBarMode>
      value={value}
      onChange={onChange}
      options={[{ value: 'system', label: 'System' }, { value: 'custom', label: 'Stage0' }]}
      aria-label="Linux window title bar"
    />
  </SettingRow>;
}
