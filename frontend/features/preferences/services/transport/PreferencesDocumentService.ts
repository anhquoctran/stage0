import type { PreferenceBootstrap } from '../../types/PreferenceBootstrap';
import type { PreferencesDocument } from '../../types/PreferencesDocument';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface PreferencesDocumentService {
  initializePreferences(input: {
    legacy: PreferenceBootstrap;
  }): Promise<PreferencesDocument>;
  loadPreferencesJson(): Promise<PreferencesDocument>;
  patchPreferences(input: {
    patch: Record<string, unknown>;
    expectedRevision: string;
  }): Promise<PreferencesDocument>;
  resetPreferencesJson(): Promise<PreferencesDocument>;
  savePreferencesJson(input: {
    content: string;
    expectedRevision: string;
  }): Promise<PreferencesDocument>;
}
