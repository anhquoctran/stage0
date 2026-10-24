import type { KeymapSettings } from '../../../core/types/keymaps/KeymapSettings';

export interface KeymapPresetPickerProps {
  value: KeymapSettings;
  onChange: (value: KeymapSettings) => void;
}
