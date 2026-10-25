import { type ThemeMode } from '../../../core/types/ThemeMode';
import { type AiConfig } from '../../ai/types/AiConfig';
import { type SandboxType } from '../../git/types/SandboxType';
import type { KeymapSettings } from '../../../core/types/keymaps/KeymapSettings';

export interface PreferencesBaseline {
  keymap: KeymapSettings;
  uiFontFamily: string;
  themeMode: ThemeMode;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  lineSpacing: number;
  enableLigatures: boolean;
  showInlineBlame: boolean;
  launchAtStartup: boolean;
  startInBackground: boolean;
  explorerContextMenu: boolean;
  addToPath: boolean;
  sandboxType: SandboxType;
  aiConfig: AiConfig;
  gitBinaryId: string;
  gitBinaryPath: string;
  markdownFontFamily: string;
  markdownCodeFontFamily: string;
  markdownEditorFontFamily: string;
  markdownFontSize: number;
  markdownHeadingWeight: number;
}
