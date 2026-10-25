import type { LinuxTitleBarMode } from '../../../core/types/LinuxTitleBarMode';
import type { MarkdownFontSettings } from './MarkdownFontSettings';
import type { ViewerFontSettings } from './ViewerFontSettings';
import type { KeymapSettings } from '../../../core/types/keymaps/KeymapSettings';

export interface PreferencesState extends ViewerFontSettings {
  keymap: KeymapSettings;
  uiFontFamily: string;
  linuxTitleBar: LinuxTitleBarMode;
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
  launchAtStartup: boolean;
  setLaunchAtStartup: (val: boolean) => void;
  startInBackground: boolean;
  setStartInBackground: (val: boolean) => void;
  explorerContextMenu: boolean;
  setExplorerContextMenu: (val: boolean) => void;
  addToPath: boolean;
  setAddToPath: (val: boolean) => void;
  markdownFontFamily: string;
  markdownCodeFontFamily: string;
  markdownEditorFontFamily: string;
  markdownFontSize: number;
  markdownHeadingFontWeight: number;
  updateMarkdownFontSettings: (settings: Partial<MarkdownFontSettings>) => void;
  resetMarkdownFontSettings: () => void;
}
