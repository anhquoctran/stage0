import type { MarkdownFontSettings } from './MarkdownFontSettings';
import type { ViewerFontSettings } from './ViewerFontSettings';

export interface PreferencesState extends ViewerFontSettings {
  isPreferencesOpen: boolean;
  setIsPreferencesOpen: (open: boolean) => void;
  initialPreferencesTab: string | null;
  setInitialPreferencesTab: (tab: string | null) => void;
  openPreferences: (tab?: string) => void;
  updateViewerFontSettings: (settings: Partial<ViewerFontSettings>) => void;
  resetViewerFontSettings: () => void;
  showInlineBlame: boolean;
  setShowInlineBlame: (show: boolean) => void;
  toggleInlineBlame: () => void;
  markdownFontFamily: string;
  markdownCodeFontFamily: string;
  markdownFontSize: number;
  markdownHeadingFontWeight: number;
  updateMarkdownFontSettings: (settings: Partial<MarkdownFontSettings>) => void;
  resetMarkdownFontSettings: () => void;
}
