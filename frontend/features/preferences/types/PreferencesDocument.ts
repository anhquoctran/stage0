import type { PreferenceBootstrap } from './PreferenceBootstrap';

export interface PreferencesDocument {
  content: string;
  revision: string;
  path: string;
  migrated: boolean;
  settings?: PreferenceBootstrap | null;
  validationError?: string | null;
}
