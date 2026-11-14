import type { PreferencesJsonEditorSaveState } from '../types/PreferencesJsonEditorSaveState';

export interface PreferencesJsonEditorHeaderProps {
  isMac: boolean;
  title?: string;
  description?: string;
  saveState: PreferencesJsonEditorSaveState;
  handleClose: () => Promise<void>;
}
