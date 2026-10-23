import type { PreferencesJsonEditorSaveState } from '../types/PreferencesJsonEditorSaveState';

export interface PreferencesJsonEditorHeaderProps {
  isMac: boolean;
  saveState: PreferencesJsonEditorSaveState;
  handleClose: () => Promise<void>;
}
