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
import { keymapErrors } from '../../../core/services/keymaps/validation';
import { DEFAULT_KEYMAP } from '../../../core/services/keymaps/catalog';
import { applyUiFontToDocument } from '../utils/applyUiFontToDocument';

// Preserve commit ordering and failure rollback; creating this closure has no side effects.
export function createPreferencesApplyAction({
  draftKeymap = DEFAULT_KEYMAP,
  draftUiFontFamily,
  draftLinuxTitleBar = 'system',
  setDraftKeymap,
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
  draftMarkdownEditorFontFamily,
  draftMarkdownFontSize,
  draftMarkdownHeadingWeight,
  draftThemeMode,
  savedBaseline,
  draftShowInlineBlame,
  draftLaunchAtStartup,
  draftStartInBackground,
  draftExplorerContextMenu,
  draftAddToPath,
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
      const errors = ['macos', 'windows', 'linux'].flatMap((platform) => keymapErrors(draftKeymap, platform));
      if (errors.length) throw new Error([...new Set(errors)].join(' '));
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
      const keymapChanged = JSON.stringify(draftKeymap) !== JSON.stringify(savedBaseline.keymap);
      const currentKeymap = usePreferencesStore.getState().keymap ?? DEFAULT_KEYMAP;
      if (keymapChanged) {
        if (JSON.stringify(currentKeymap) !== JSON.stringify(savedBaseline.keymap) && JSON.stringify(currentKeymap) !== JSON.stringify(draftKeymap))
          throw new Error('Keymap changed in another window or editor. Reopen Preferences before applying your keymap draft');
        additionalPreferences.keymap = draftKeymap;
      }
      const appearancePatch: Record<string, unknown> = {};
      const titleBarChanged = draftLinuxTitleBar !== (savedBaseline.linuxTitleBar ?? 'system');
      if (titleBarChanged) {
        const current = usePreferencesStore.getState().linuxTitleBar ?? 'system';
        if (current !== (savedBaseline.linuxTitleBar ?? 'system') && current !== draftLinuxTitleBar)
          throw new Error('Window title bar changed in another window. Reopen Preferences before applying');
        appearancePatch.linuxTitleBar = draftLinuxTitleBar;
      }
      const uiFontChanged = draftUiFontFamily !== savedBaseline.uiFontFamily;
      if (uiFontChanged) {
        const currentUiFont = usePreferencesStore.getState().uiFontFamily;
        if (currentUiFont !== savedBaseline.uiFontFamily && currentUiFont !== draftUiFontFamily)
          throw new Error('UI font changed in another window or editor. Reopen Preferences before applying your UI font draft');
        appearancePatch.uiFont = { fontFamily: draftUiFontFamily };
      }
      if (draftThemeMode !== savedBaseline.themeMode) appearancePatch.themeMode = draftThemeMode;
      const fontChanged = (Object.keys(fontSettings) as Array<keyof ViewerFontSettings>).some(
        (key) => fontSettings[key] !== savedBaseline[key]
      );
      if (fontChanged) appearancePatch.viewerFont = fontSettings;

      const markdownFontSettings = {
        fontFamily: draftMarkdownFontFamily,
        codeFontFamily: draftMarkdownCodeFontFamily,
        editorFontFamily: draftMarkdownEditorFontFamily,
        fontSize: draftMarkdownFontSize,
        headingFontWeight: draftMarkdownHeadingWeight,
      };
      const markdownFontChanged =
        draftMarkdownFontFamily !== savedBaseline.markdownFontFamily ||
        draftMarkdownCodeFontFamily !== savedBaseline.markdownCodeFontFamily ||
        draftMarkdownEditorFontFamily !== savedBaseline.markdownEditorFontFamily ||
        draftMarkdownFontSize !== savedBaseline.markdownFontSize ||
        draftMarkdownHeadingWeight !== savedBaseline.markdownHeadingWeight;
      if (markdownFontChanged) appearancePatch.markdownFont = markdownFontSettings;

      if (Object.keys(appearancePatch).length) additionalPreferences.appearance = appearancePatch;
      const generalPatch: Record<string, unknown> = {};
      if (draftShowInlineBlame !== savedBaseline.showInlineBlame) {
        generalPatch.showInlineBlame = draftShowInlineBlame;
      }
      if (draftLaunchAtStartup !== savedBaseline.launchAtStartup) {
        generalPatch.launchAtStartup = draftLaunchAtStartup;
      }
      if (draftStartInBackground !== savedBaseline.startInBackground) {
        generalPatch.startInBackground = draftStartInBackground;
      }
      if (draftExplorerContextMenu !== savedBaseline.explorerContextMenu) {
        generalPatch.explorerContextMenu = draftExplorerContextMenu;
      }
      if (draftAddToPath !== savedBaseline.addToPath) {
        generalPatch.addToPath = draftAddToPath;
      }
      if (Object.keys(generalPatch).length) {
        additionalPreferences.general = generalPatch;
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
      const committedKeymap = keymapChanged ? draftKeymap : usePreferencesStore.getState().keymap ?? DEFAULT_KEYMAP;
      const committedUiFont = uiFontChanged ? draftUiFontFamily : usePreferencesStore.getState().uiFontFamily;
      usePreferencesStore.setState({
        keymap: committedKeymap,
        uiFontFamily: committedUiFont,
        linuxTitleBar: titleBarChanged ? draftLinuxTitleBar : usePreferencesStore.getState().linuxTitleBar ?? 'system',
        ...fontSettings,
        showInlineBlame: draftShowInlineBlame,
        launchAtStartup: draftLaunchAtStartup,
        startInBackground: draftStartInBackground,
        explorerContextMenu: draftExplorerContextMenu,
        addToPath: draftAddToPath,
        markdownFontFamily: draftMarkdownFontFamily,
        markdownCodeFontFamily: draftMarkdownCodeFontFamily,
        markdownEditorFontFamily: draftMarkdownEditorFontFamily,
        markdownFontSize: draftMarkdownFontSize,
        markdownHeadingFontWeight: draftMarkdownHeadingWeight,
      });
      applyViewerFontToDocument(fontSettings);
      applyUiFontToDocument(committedUiFont);
      applyMarkdownFontToDocument(markdownFontSettings);
      const needsRestart = titleBarChanged ||
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
        keymap: committedKeymap,
        uiFontFamily: committedUiFont,
        linuxTitleBar: titleBarChanged ? draftLinuxTitleBar : usePreferencesStore.getState().linuxTitleBar ?? 'system',
        themeMode: draftThemeMode,
        fontFamily: draftFontFamily,
        fontSize: draftFontSize,
        isBold: draftIsBold,
        isItalic: draftIsItalic,
        isUnderline: draftIsUnderline,
        lineSpacing: draftLineSpacing,
        enableLigatures: draftEnableLigatures,
        showInlineBlame: draftShowInlineBlame,
        launchAtStartup: draftLaunchAtStartup,
        startInBackground: draftStartInBackground,
        explorerContextMenu: draftExplorerContextMenu,
        addToPath: draftAddToPath,
        sandboxType: draftSandboxType,
        aiConfig: committedAi.aiConfig,
        gitBinaryId: draftGitBinaryId,
        gitBinaryPath: draftGitBinaryPath,
        markdownFontFamily: draftMarkdownFontFamily,
        markdownCodeFontFamily: draftMarkdownCodeFontFamily,
        markdownEditorFontFamily: draftMarkdownEditorFontFamily,
        markdownFontSize: draftMarkdownFontSize,
        markdownHeadingWeight: draftMarkdownHeadingWeight,
      });
      setDraftKeymap(committedKeymap);
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
