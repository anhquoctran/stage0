import { useEffect, useRef, useState } from 'react';
import { type ThemeMode } from '../../../core/types/ThemeMode';
import { captureAiPreferences } from '../../ai/services/commitAiPreferences';
import { type SandboxType } from '../../git/types/SandboxType';
import type { PreferencesBaseline } from '../types/PreferencesBaseline';
import type { PreferencesDraftSessionContext } from './PreferencesDraftSessionContext';
import { DEFAULT_KEYMAP } from '../../../core/services/keymaps/catalog';

export function usePreferencesDraftSession({
  storedKeymap = DEFAULT_KEYMAP,
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
  storedMarkdownFontFamily,
  storedMarkdownCodeFontFamily,
  storedMarkdownFontSize,
  storedMarkdownHeadingWeight,
  isPreferencesOpen,
  aiDraftStore,
  setAiBaseline,
  setApplyError,
  fetchActiveBinary,
  setSearchQuery,
  setActiveTab,
  setExpandedGroups,
}: PreferencesDraftSessionContext) {
  const [draftKeymap, setDraftKeymap] = useState(storedKeymap);
  const [draftThemeMode, setDraftThemeMode] = useState<ThemeMode>(storedThemeMode);

  const [draftThemeId, setDraftThemeId] = useState('catppuccin-mocha');

  const [draftFontFamily, setDraftFontFamily] = useState(storedFontFamily);

  const [draftFontSize, setDraftFontSize] = useState(storedFontSize);

  const [draftIsBold, setDraftIsBold] = useState(storedIsBold);

  const [draftIsItalic, setDraftIsItalic] = useState(storedIsItalic);

  const [draftIsUnderline, setDraftIsUnderline] = useState(storedIsUnderline);

  const [draftLineSpacing, setDraftLineSpacing] = useState(storedLineSpacing);

  const [draftEnableLigatures, setDraftEnableLigatures] = useState(storedEnableLigatures);

  const [draftMarkdownFontFamily, setDraftMarkdownFontFamily] = useState(storedMarkdownFontFamily);

  const [draftMarkdownCodeFontFamily, setDraftMarkdownCodeFontFamily] = useState(storedMarkdownCodeFontFamily);

  const [draftMarkdownFontSize, setDraftMarkdownFontSize] = useState(storedMarkdownFontSize);

  const [draftMarkdownHeadingWeight, setDraftMarkdownHeadingWeight] = useState(storedMarkdownHeadingWeight);

  const [draftDiffViewMode, setDraftDiffViewMode] = useState<'split' | 'unified'>('split');

  const [draftIgnoreWhitespace, setDraftIgnoreWhitespace] = useState(false);

  const [draftWordWrap, setDraftWordWrap] = useState(false);

  const [draftShowInlineBlame, setDraftShowInlineBlame] = useState(storedShowInlineBlame);

  const [draftSandboxType, setDraftSandboxType] = useState<SandboxType>(storedSandboxType);

  const [draftGitBinaryId, setDraftGitBinaryId] = useState(storedGitBinaryId);

  const [draftGitBinaryPath, setDraftGitBinaryPath] = useState(storedGitBinaryPath);

  const [savedBaseline, setSavedBaseline] = useState<PreferencesBaseline>({
    keymap: storedKeymap,
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
    markdownFontFamily: storedMarkdownFontFamily,
    markdownCodeFontFamily: storedMarkdownCodeFontFamily,
    markdownFontSize: storedMarkdownFontSize,
    markdownHeadingWeight: storedMarkdownHeadingWeight,
  });

  const [isApplied, setIsApplied] = useState(false);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [showRestartPrompt, setShowRestartPrompt] = useState(false);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isPreferencesOpen) {
      if (!wasOpenRef.current) {
        wasOpenRef.current = true;
        setDraftKeymap(storedKeymap);
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
        setDraftMarkdownFontFamily(storedMarkdownFontFamily);
        setDraftMarkdownCodeFontFamily(storedMarkdownCodeFontFamily);
        setDraftMarkdownFontSize(storedMarkdownFontSize);
        setDraftMarkdownHeadingWeight(storedMarkdownHeadingWeight);

        const snapshot = captureAiPreferences();
        aiDraftStore.getState().replace(snapshot);
        setAiBaseline(snapshot);
        setApplyError(null);
        setDraftGitBinaryId(storedGitBinaryId);
        setDraftGitBinaryPath(storedGitBinaryPath);

        setSavedBaseline({
          keymap: storedKeymap,
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
          markdownFontFamily: storedMarkdownFontFamily,
          markdownCodeFontFamily: storedMarkdownCodeFontFamily,
          markdownFontSize: storedMarkdownFontSize,
          markdownHeadingWeight: storedMarkdownHeadingWeight,
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
    storedKeymap,
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
    storedMarkdownFontFamily,
    storedMarkdownCodeFontFamily,
    storedMarkdownFontSize,
    storedMarkdownHeadingWeight,
    fetchActiveBinary,
  ]);

  return {
    draftKeymap,
    setDraftKeymap,
    draftShowInlineBlame,
    draftThemeMode,
    draftFontFamily,
    draftFontSize,
    draftIsBold,
    draftIsItalic,
    draftIsUnderline,
    draftLineSpacing,
    draftEnableLigatures,
    draftMarkdownFontFamily,
    draftMarkdownCodeFontFamily,
    draftMarkdownFontSize,
    draftMarkdownHeadingWeight,
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
    setDraftMarkdownFontFamily,
    setDraftMarkdownCodeFontFamily,
    setDraftMarkdownFontSize,
    setDraftMarkdownHeadingWeight,
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
