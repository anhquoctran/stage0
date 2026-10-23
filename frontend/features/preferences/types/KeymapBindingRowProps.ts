import type { KeymapCommand } from '../../../core/types/keymaps/KeymapCommand';
import type { KeymapSettings } from '../../../core/types/keymaps/KeymapSettings';

export interface KeymapBindingRowProps {
  command: KeymapCommand;
  settings: KeymapSettings;
  onChange: (settings: KeymapSettings) => void;
  mac: boolean;
}
