import type { MarkdownFontSettings } from '../types/MarkdownFontSettings';

export const DEFAULT_MARKDOWN_FONT_SETTINGS: MarkdownFontSettings = {
  fontFamily: 'Arial',
  codeFontFamily: 'Fira Code',
  editorFontFamily: 'Fira Code',
  fontSize: 14,
  headingFontWeight: 600,
};

export const MARKDOWN_PROSE_FONTS: string[] = [
  'Arial',
  'Inter',
  'Segoe UI',
  'Roboto',
  'SF Pro Text',
  'Helvetica Neue',
  'Georgia',
  'Times New Roman',
];

export const MARKDOWN_CODE_FONTS: string[] = [
  'Fira Code',
  'JetBrains Mono',
  'Cascadia Code',
  'Source Code Pro',
  'Hack',
  'Consolas',
  'Monaco',
  'Courier New',
];

export const MARKDOWN_EDITOR_FONTS = [...new Set([...MARKDOWN_CODE_FONTS, ...MARKDOWN_PROSE_FONTS])];
