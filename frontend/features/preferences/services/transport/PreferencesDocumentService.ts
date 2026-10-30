import type { PreferenceBootstrap } from '../../types/PreferenceBootstrap';
import type { PreferencesDocument } from '../../types/PreferencesDocument';
import type { PreferencesTransactionInput } from '../../types/PreferencesTransactionInput';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface PreferencesDocumentService {
  commitPreferencesTransaction(input: { request: PreferencesTransactionInput }): Promise<{
    document: PreferencesDocument;
    configured: Record<string, boolean>;
  }>;
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
