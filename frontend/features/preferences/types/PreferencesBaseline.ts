import { type ThemeMode } from '../../../core/types/ThemeMode';
import { type AiConfig } from '../../ai/types/AiConfig';
import { type SandboxType } from '../../git/types/SandboxType';

export interface PreferencesBaseline {
  themeMode: ThemeMode;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  lineSpacing: number;
  enableLigatures: boolean;
  showInlineBlame: boolean;
  sandboxType: SandboxType;
  aiConfig: AiConfig;
  gitBinaryId: string;
  gitBinaryPath: string;
}
