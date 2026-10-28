import type { Dispatch, SetStateAction } from 'react';
import type { LanguagePreferences } from './LanguagePreferences';

export interface PreferencesLanguageTabProps {
  value: LanguagePreferences;
  onChange: Dispatch<SetStateAction<LanguagePreferences>>;
  disabled: boolean;
  error: string | null;
}
