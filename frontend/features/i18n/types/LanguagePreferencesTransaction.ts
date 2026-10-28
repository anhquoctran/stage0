import type { LanguagePreferences } from './LanguagePreferences';

export interface LanguagePreferencesTransaction {
  value: LanguagePreferences;
  baseline: LanguagePreferences;
  loading: boolean;
  error: string | null;
  acceptCommitted: () => Promise<void>;
}
