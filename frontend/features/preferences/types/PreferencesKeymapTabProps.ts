import type { KeymapSettings } from '../../../core/types/keymaps/KeymapSettings';

export interface PreferencesKeymapTabProps {
  value: KeymapSettings;
  onChange: (value: KeymapSettings) => void;
}
