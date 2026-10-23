export interface PreferencesNavigationContext {
  isPreferencesOpen: boolean;
  initialPreferencesTab: string | null;
  setInitialPreferencesTab: (tab: string | null) => void;
}
