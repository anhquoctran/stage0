import type { PreferencesBaseline } from '../types/PreferencesBaseline';

export function countUnsavedPreferences(
  draft: {
    showInlineBlame: boolean;
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
  },
  baseline: PreferencesBaseline,
  aiChangeCount: number
): number {
  let count = aiChangeCount;
  if (draft.showInlineBlame !== baseline.showInlineBlame) count++;
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
  return count;
}

