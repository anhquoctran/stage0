import {
  applyThemeToDocument,
  persistThemeMode,
  resolveTheme,
  useThemeStore,
} from '../../../core/store/useThemeStore';
import { commitAiPreferences } from '../../ai/services/commitAiPreferences';
import { useGitBinaryStore } from '../../git/store/useGitBinaryStore';
import { useGitStore } from '../../git/store/useGitStore';
import { applyViewerFontToDocument, usePreferencesStore } from '../store/usePreferencesStore';
import { applyMarkdownFontToDocument } from '../utils/applyMarkdownFontToDocument';
import type { PreferencesApplyContext } from '../types/PreferencesApplyContext';
import { type ViewerFontSettings } from '../types/ViewerFontSettings';

// Preserve commit ordering and failure rollback; creating this closure has no side effects.
export function createPreferencesApplyAction({
  applyingRef,
  setIsApplying,
  setApplyError,
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
  draftThemeMode,
  savedBaseline,
  draftShowInlineBlame,
  draftSandboxType,
  draftGitBinaryId,
  draftGitBinaryPath,
  aiDraftStore,
  aiBaseline,
  setAiBaseline,
  showToast,
  setSavedBaseline,
  setIsApplied,
  setShowRestartPrompt,
}: PreferencesApplyContext) {
  const handleApply = async () => {
    if (applyingRef.current) return false;
    applyingRef.current = true;
    setIsApplying(true);
    setApplyError(null);
    try {
      const fontSettings: ViewerFontSettings = {
        fontFamily: draftFontFamily,
        fontSize: draftFontSize,
        isBold: draftIsBold,
        isItalic: draftIsItalic,
        isUnderline: draftIsUnderline,
        lineSpacing: draftLineSpacing,
        enableLigatures: draftEnableLigatures,
      };
      const additionalPreferences: Record<string, unknown> = {};
      const appearancePatch: Record<string, unknown> = {};
      if (draftThemeMode !== savedBaseline.themeMode) appearancePatch.themeMode = draftThemeMode;
      const fontChanged = (Object.keys(fontSettings) as Array<keyof ViewerFontSettings>).some(
        (key) => fontSettings[key] !== savedBaseline[key]
      );
      if (fontChanged) appearancePatch.viewerFont = fontSettings;

      const markdownFontSettings = {
        fontFamily: draftMarkdownFontFamily,
        codeFontFamily: draftMarkdownCodeFontFamily,
        fontSize: draftMarkdownFontSize,
        headingFontWeight: draftMarkdownHeadingWeight,
      };
      const markdownFontChanged =
        draftMarkdownFontFamily !== savedBaseline.markdownFontFamily ||
        draftMarkdownCodeFontFamily !== savedBaseline.markdownCodeFontFamily ||
        draftMarkdownFontSize !== savedBaseline.markdownFontSize ||
        draftMarkdownHeadingWeight !== savedBaseline.markdownHeadingWeight;
      if (markdownFontChanged) appearancePatch.markdownFont = markdownFontSettings;

      if (Object.keys(appearancePatch).length) additionalPreferences.appearance = appearancePatch;
      if (draftShowInlineBlame !== savedBaseline.showInlineBlame) {
        additionalPreferences.general = { showInlineBlame: draftShowInlineBlame };
      }
      if (draftSandboxType !== savedBaseline.sandboxType)
        additionalPreferences.sandbox = { type: draftSandboxType };
      if (
        draftGitBinaryId !== savedBaseline.gitBinaryId ||
        draftGitBinaryPath !== savedBaseline.gitBinaryPath
      ) {
        additionalPreferences.git = {
          binaryId: draftGitBinaryId,
          binaryPath: draftGitBinaryPath,
        };
      }
      const committedAi = await commitAiPreferences(
        aiDraftStore.getState(),
        aiBaseline,
        additionalPreferences
      );
      aiDraftStore.getState().replace(committedAi);
      setAiBaseline(committedAi);
      const resolvedTheme = resolveTheme(draftThemeMode);
      useThemeStore.setState({ themeMode: draftThemeMode, theme: resolvedTheme });
      applyThemeToDocument(resolvedTheme);
      persistThemeMode(draftThemeMode);
      usePreferencesStore.setState({
        ...fontSettings,
        showInlineBlame: draftShowInlineBlame,
        markdownFontFamily: draftMarkdownFontFamily,
        markdownCodeFontFamily: draftMarkdownCodeFontFamily,
        markdownFontSize: draftMarkdownFontSize,
        markdownHeadingFontWeight: draftMarkdownHeadingWeight,
      });
      applyViewerFontToDocument(fontSettings);
      applyMarkdownFontToDocument(markdownFontSettings);
      const needsRestart =
        draftGitBinaryId !== savedBaseline.gitBinaryId ||
        draftGitBinaryPath !== savedBaseline.gitBinaryPath;
      const sandboxChanged = draftSandboxType !== savedBaseline.sandboxType;
      useGitStore.setState({ activeSandboxType: draftSandboxType });
      if (sandboxChanged) {
        const label =
          draftSandboxType === 'in_memory'
            ? 'In-Memory Sandbox'
            : draftSandboxType === 'local_worktree'
              ? 'Local Worktree Sandbox'
              : 'Docker Container Sandbox';
        showToast(`Switched active sandbox to: ${label}`);
        void useGitStore.getState().refreshDiff();
      }
      useGitBinaryStore.setState((state) => ({
        activeBinaryId: draftGitBinaryId,
        activeBinaryPath: draftGitBinaryPath,
        binaries: state.binaries.map((binary) => ({
          ...binary,
          is_active: binary.id === draftGitBinaryId,
        })),
        error: null,
        isLoading: false,
      }));
      setSavedBaseline({
        themeMode: draftThemeMode,
        fontFamily: draftFontFamily,
        fontSize: draftFontSize,
        isBold: draftIsBold,
        isItalic: draftIsItalic,
        isUnderline: draftIsUnderline,
        lineSpacing: draftLineSpacing,
        enableLigatures: draftEnableLigatures,
        showInlineBlame: draftShowInlineBlame,
        sandboxType: draftSandboxType,
        aiConfig: committedAi.aiConfig,
        gitBinaryId: draftGitBinaryId,
        gitBinaryPath: draftGitBinaryPath,
        markdownFontFamily: draftMarkdownFontFamily,
        markdownCodeFontFamily: draftMarkdownCodeFontFamily,
        markdownFontSize: draftMarkdownFontSize,
        markdownHeadingWeight: draftMarkdownHeadingWeight,
      });
      setIsApplied(true);
      setTimeout(() => setIsApplied(false), 2000);
      showToast('Preferences applied successfully');
      if (needsRestart) setShowRestartPrompt(true);
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error ?? '').trim();
      setApplyError(
        detail
          ? `Could not apply preferences: ${detail}. Your drafts are still available.`
          : 'Could not apply preferences. Your drafts are still available.'
      );
      return false;
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
    }
  };
  return handleApply;
}
