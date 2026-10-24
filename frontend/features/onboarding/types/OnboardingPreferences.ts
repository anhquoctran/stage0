import type { KeymapSettings } from '../../../core/types/keymaps/KeymapSettings';
import type { ThemeMode } from '../../../core/types/ThemeMode';
import type { ViewerFontSettings } from '../../preferences/types/ViewerFontSettings';
import type { MarkdownFontSettings } from '../../preferences/types/MarkdownFontSettings';

export interface OnboardingPreferences {
  keymap: KeymapSettings;
  themeMode: ThemeMode;
  uiFontFamily: string;
  viewerFont: ViewerFontSettings;
  markdownFont: MarkdownFontSettings;
}
