import React from 'react';
import type { PreferencesJsonEditorSaveState } from '../types/PreferencesJsonEditorSaveState';

export interface PreferencesJsonCodeBufferContext {
  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
  setSaveState: React.Dispatch<React.SetStateAction<PreferencesJsonEditorSaveState>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}
