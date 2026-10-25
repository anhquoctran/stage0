import type { PreferencesBaseline } from '../types/PreferencesBaseline';

export function countUnsavedPreferences(
  draft: {
    showInlineBlame: boolean;
    launchAtStartup?: boolean;
    startInBackground?: boolean;
    explorerContextMenu?: boolean;
    addToPath?: boolean;
    uiFontFamily?: string;
    themeMode: string;
    fontFamily: string;
    fontSize: number;
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
    lineSpacing: number;
    enableLigatures: boolean;
    sandboxType: string;
    gitBinaryId: string;
    markdownFontFamily?: string;
    markdownCodeFontFamily?: string;
    markdownEditorFontFamily?: string;
    markdownFontSize?: number;
    markdownHeadingWeight?: number;
  },
  baseline: PreferencesBaseline,
  aiChangeCount: number
): number {
  let count = aiChangeCount;
  if (draft.uiFontFamily !== undefined && draft.uiFontFamily !== baseline.uiFontFamily) count++;
  if (draft.showInlineBlame !== baseline.showInlineBlame) count++;
  if (draft.launchAtStartup !== undefined && draft.launchAtStartup !== baseline.launchAtStartup) count++;
  if (draft.startInBackground !== undefined && draft.startInBackground !== baseline.startInBackground) count++;
  if (draft.explorerContextMenu !== undefined && draft.explorerContextMenu !== baseline.explorerContextMenu) count++;
  if (draft.addToPath !== undefined && draft.addToPath !== baseline.addToPath) count++;
  if (draft.themeMode !== baseline.themeMode) count++;
  if (draft.fontFamily !== baseline.fontFamily) count++;
  if (draft.fontSize !== baseline.fontSize) count++;
  if (draft.isBold !== baseline.isBold) count++;
  if (draft.isItalic !== baseline.isItalic) count++;
  if (draft.isUnderline !== baseline.isUnderline) count++;
  if (draft.lineSpacing !== baseline.lineSpacing) count++;
  if (draft.enableLigatures !== baseline.enableLigatures) count++;
  if (draft.sandboxType !== baseline.sandboxType) count++;
  if (draft.gitBinaryId !== baseline.gitBinaryId) count++;
  if (draft.markdownFontFamily !== undefined && draft.markdownFontFamily !== baseline.markdownFontFamily) count++;
  if (draft.markdownCodeFontFamily !== undefined && draft.markdownCodeFontFamily !== baseline.markdownCodeFontFamily) count++;
  if (draft.markdownEditorFontFamily !== undefined && draft.markdownEditorFontFamily !== baseline.markdownEditorFontFamily) count++;
  if (draft.markdownFontSize !== undefined && draft.markdownFontSize !== baseline.markdownFontSize) count++;
  if (draft.markdownHeadingWeight !== undefined && draft.markdownHeadingWeight !== baseline.markdownHeadingWeight) count++;
  return count;
}
