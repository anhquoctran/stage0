import { useMemo } from 'react';
import { aiPreferencesChangeCount } from '../../ai/utils/aiPreferencesSnapshot';
import { countUnsavedPreferences } from '../utils/countUnsavedPreferences';
import type { PreferencesChangeCountContext } from './PreferencesChangeCountContext';

export function usePreferencesChangeCount({
  session,
  aiDraft,
  aiBaseline,
  draftAiConfig,
}: PreferencesChangeCountContext) {
  const totalUnsaved = useMemo(() => {
    return (JSON.stringify(session.draftKeymap) !== JSON.stringify(session.savedBaseline.keymap) ? 1 : 0) + countUnsavedPreferences(
      {
        showInlineBlame: session.draftShowInlineBlame,
        themeMode: session.draftThemeMode,
        fontFamily: session.draftFontFamily,
        fontSize: session.draftFontSize,
        isBold: session.draftIsBold,
        isItalic: session.draftIsItalic,
        isUnderline: session.draftIsUnderline,
        lineSpacing: session.draftLineSpacing,
        enableLigatures: session.draftEnableLigatures,
        sandboxType: session.draftSandboxType,
        gitBinaryId: session.draftGitBinaryId,
      },
      session.savedBaseline,
      aiPreferencesChangeCount(aiDraft, aiBaseline)
    );
  }, [
    session.draftKeymap,
    session.draftShowInlineBlame,
    draftAiConfig,
    session.draftThemeMode,
    session.draftFontFamily,
    session.draftFontSize,
    session.draftIsBold,
    session.draftIsItalic,
    session.draftIsUnderline,
    session.draftLineSpacing,
    session.draftEnableLigatures,
    session.draftSandboxType,
    session.draftGitBinaryId,
    session.savedBaseline,
    aiDraft,
    aiBaseline,
  ]);

  return { totalUnsaved };
}
