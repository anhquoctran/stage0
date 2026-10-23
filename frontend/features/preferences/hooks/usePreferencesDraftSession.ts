import { useEffect, useRef, useState } from 'react';
import { type ThemeMode } from '../../../core/types/ThemeMode';
import { captureAiPreferences } from '../../ai/services/commitAiPreferences';
import { type SandboxType } from '../../git/types/SandboxType';
import type { PreferencesBaseline } from '../types/PreferencesBaseline';
import type { PreferencesDraftSessionContext } from './PreferencesDraftSessionContext';

export function usePreferencesDraftSession({
  storedThemeMode,
  storedFontFamily,
  storedFontSize,
  storedIsBold,
  storedIsItalic,
  storedIsUnderline,
  storedLineSpacing,
  storedEnableLigatures,
  storedShowInlineBlame,
  storedSandboxType,
  storedGitBinaryId,
  storedGitBinaryPath,
  storedAiConfig,
  isPreferencesOpen,
  aiDraftStore,
  setAiBaseline,
  setApplyError,
  fetchActiveBinary,
  setSearchQuery,
  setActiveTab,
  setExpandedGroups,
}: PreferencesDraftSessionContext) {
  const [draftThemeMode, setDraftThemeMode] = useState<ThemeMode>(storedThemeMode);

  const [draftThemeId, setDraftThemeId] = useState('catppuccin-mocha');

  const [draftFontFamily, setDraftFontFamily] = useState(storedFontFamily);

  const [draftFontSize, setDraftFontSize] = useState(storedFontSize);

  const [draftIsBold, setDraftIsBold] = useState(storedIsBold);

  const [draftIsItalic, setDraftIsItalic] = useState(storedIsItalic);

  const [draftIsUnderline, setDraftIsUnderline] = useState(storedIsUnderline);

  const [draftLineSpacing, setDraftLineSpacing] = useState(storedLineSpacing);

  const [draftEnableLigatures, setDraftEnableLigatures] = useState(storedEnableLigatures);

  const [draftDiffViewMode, setDraftDiffViewMode] = useState<'split' | 'unified'>('split');

  const [draftIgnoreWhitespace, setDraftIgnoreWhitespace] = useState(false);

  const [draftWordWrap, setDraftWordWrap] = useState(false);

  const [draftShowInlineBlame, setDraftShowInlineBlame] = useState(storedShowInlineBlame);

  const [draftSandboxType, setDraftSandboxType] = useState<SandboxType>(storedSandboxType);

  const [draftGitBinaryId, setDraftGitBinaryId] = useState(storedGitBinaryId);

  const [draftGitBinaryPath, setDraftGitBinaryPath] = useState(storedGitBinaryPath);

  const [savedBaseline, setSavedBaseline] = useState<PreferencesBaseline>({
    themeMode: storedThemeMode,
    fontFamily: storedFontFamily,
    fontSize: storedFontSize,
    isBold: storedIsBold,
    isItalic: storedIsItalic,
    isUnderline: storedIsUnderline,
    lineSpacing: storedLineSpacing,
    enableLigatures: storedEnableLigatures,
    showInlineBlame: storedShowInlineBlame,
    sandboxType: storedSandboxType,
    aiConfig: { ...storedAiConfig },
    gitBinaryId: storedGitBinaryId,
    gitBinaryPath: storedGitBinaryPath,
  });

  const [isApplied, setIsApplied] = useState(false);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [showRestartPrompt, setShowRestartPrompt] = useState(false);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isPreferencesOpen) {
      if (!wasOpenRef.current) {
        wasOpenRef.current = true;
        setDraftThemeMode(storedThemeMode);
        setDraftFontFamily(storedFontFamily);
        setDraftFontSize(storedFontSize);
        setDraftIsBold(storedIsBold);
        setDraftIsItalic(storedIsItalic);
        setDraftIsUnderline(storedIsUnderline);
        setDraftLineSpacing(storedLineSpacing);
        setDraftEnableLigatures(storedEnableLigatures);
        setDraftShowInlineBlame(storedShowInlineBlame);
        setDraftSandboxType(storedSandboxType);
        const snapshot = captureAiPreferences();
        aiDraftStore.getState().replace(snapshot);
        setAiBaseline(snapshot);
        setApplyError(null);
        setDraftGitBinaryId(storedGitBinaryId);
        setDraftGitBinaryPath(storedGitBinaryPath);

        setSavedBaseline({
          themeMode: storedThemeMode,
          fontFamily: storedFontFamily,
          fontSize: storedFontSize,
          isBold: storedIsBold,
          isItalic: storedIsItalic,
          isUnderline: storedIsUnderline,
          lineSpacing: storedLineSpacing,
          enableLigatures: storedEnableLigatures,
          showInlineBlame: storedShowInlineBlame,
          sandboxType: storedSandboxType,
          aiConfig: { ...storedAiConfig },
          gitBinaryId: storedGitBinaryId,
          gitBinaryPath: storedGitBinaryPath,
        });

        fetchActiveBinary().then((res) => {
          setDraftGitBinaryId(res.id);
          setDraftGitBinaryPath(res.path);
          setSavedBaseline((prev) => ({
            ...prev,
            gitBinaryId: res.id,
            gitBinaryPath: res.path,
          }));
        });

        setSearchQuery('');
        setIsApplied(false);
        setShowResetConfirm(false);
        setShowRestartPrompt(false);
      }
    } else {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        setActiveTab(null);
        setExpandedGroups({});
        aiDraftStore.getState().replace(captureAiPreferences());
      }
    }
  }, [
    isPreferencesOpen,
    storedThemeMode,
    storedFontFamily,
    storedFontSize,
    storedIsBold,
    storedIsItalic,
    storedIsUnderline,
    storedLineSpacing,
    storedEnableLigatures,
    storedShowInlineBlame,
    storedSandboxType,
    storedAiConfig,
    storedGitBinaryId,
    storedGitBinaryPath,
    fetchActiveBinary,
  ]);

  return {
    draftShowInlineBlame,
    draftThemeMode,
    draftFontFamily,
    draftFontSize,
    draftIsBold,
    draftIsItalic,
    draftIsUnderline,
    draftLineSpacing,
    draftEnableLigatures,
    draftSandboxType,
    draftGitBinaryId,
    savedBaseline,
    setIsApplied,
    draftGitBinaryPath,
    setSavedBaseline,
    setShowRestartPrompt,
    setDraftThemeMode,
    setDraftFontFamily,
    setDraftFontSize,
    setDraftIsBold,
    setDraftIsItalic,
    setDraftIsUnderline,
    setDraftLineSpacing,
    setDraftEnableLigatures,
    setDraftShowInlineBlame,
    setDraftSandboxType,
    setShowResetConfirm,
    showResetConfirm,
    isApplied,
    showRestartPrompt,
    draftThemeId,
    setDraftThemeId,
    draftDiffViewMode,
    setDraftDiffViewMode,
    draftIgnoreWhitespace,
    setDraftIgnoreWhitespace,
    draftWordWrap,
    setDraftWordWrap,
    setDraftGitBinaryId,
    setDraftGitBinaryPath,
  };
}
