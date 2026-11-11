import {
  applyThemeToDocument,
  persistThemeMode,
  persistThemeSelection,
  resolveTheme,
  useThemeStore,
} from '../../../core/store/useThemeStore';
import i18n from '../../i18n/i18n';
import { commitAiPreferences } from '../../ai/services/commitAiPreferences';
import { useGitBinaryStore } from '../../git/store/useGitBinaryStore';
import { useGitStore } from '../../git/store/useGitStore';
import { applyViewerFontToDocument, usePreferencesStore } from '../store/usePreferencesStore';
import { applyMarkdownFontToDocument } from '../utils/applyMarkdownFontToDocument';
import type { PreferencesApplyContext } from '../types/PreferencesApplyContext';
import { type ViewerFontSettings } from '../types/ViewerFontSettings';
import { keymapErrors } from '../../../core/services/keymaps/validation';
import { DEFAULT_KEYMAP } from '../../../core/services/keymaps/catalog';
import { DEFAULT_THEMES } from '../../../core/themes/catalog';
import { DEFAULT_UI_DENSITY, normalizeUiDensity, readUiDensity } from '../utils/uiDensity';
import { applyUiDensityToDocument } from '../utils/applyUiDensityToDocument';
import { applyUiFontToDocument } from '../utils/applyUiFontToDocument';
import { languagePreferencesPatch, readLanguagePreferences } from '../../i18n/services/languagePreferences';
import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import { preferencesJsonService } from './preferencesJsonService';
import { synchronizeWorkspacePreferences } from '../../git/services/synchronizeWorkspacePreferences';

// Advance draft baselines only after native commit; creating this closure is inert.
export function createPreferencesApplyAction({
  languageDraft,
  draftKeymap = DEFAULT_KEYMAP,
  draftUiFontFamily,
  draftUiDensity = DEFAULT_UI_DENSITY,
  setDraftUiDensity,
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
  setDraftThemeMode,
  draftDarkThemeId,
  setDraftDarkThemeId,
  draftLightThemeId,
  setDraftLightThemeId,
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
    if (applyingRef.current || languageDraft?.loading || languageDraft?.error) return false;
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
      const languagePatch = languageDraft
        ? languagePreferencesPatch(languageDraft.value, languageDraft.baseline) : undefined;
      if (languagePatch?.ai) additionalPreferences.ai = languagePatch.ai;
      const keymapChanged = JSON.stringify(draftKeymap) !== JSON.stringify(savedBaseline.keymap);
      const currentKeymap = usePreferencesStore.getState().keymap ?? DEFAULT_KEYMAP;
      if (keymapChanged) {
        if (JSON.stringify(currentKeymap) !== JSON.stringify(savedBaseline.keymap) && JSON.stringify(currentKeymap) !== JSON.stringify(draftKeymap))
          throw new Error('Keymap changed in another window or editor. Reopen Preferences before applying your keymap draft');
        additionalPreferences.keymap = draftKeymap;
      }
      const appearancePatch: Record<string, unknown> = { ...languagePatch?.appearance };
      const titleBarChanged = draftLinuxTitleBar !== (savedBaseline.linuxTitleBar ?? 'system');
      if (titleBarChanged) {
        const current = usePreferencesStore.getState().linuxTitleBar ?? 'system';
        if (current !== (savedBaseline.linuxTitleBar ?? 'system') && current !== draftLinuxTitleBar)
          throw new Error('Window title bar changed in another window. Reopen Preferences before applying');
        appearancePatch.linuxTitleBar = draftLinuxTitleBar;
      }
      const densityChanged = draftUiDensity !== normalizeUiDensity(savedBaseline.uiDensity);
      const validateDensity = (current: unknown) => {
        const density = normalizeUiDensity(current);
        if (densityChanged && density !== normalizeUiDensity(savedBaseline.uiDensity) && density !== draftUiDensity)
          throw new Error(i18n.t('preferences.density.conflict'));
      };
      if (densityChanged) {
        validateDensity(usePreferencesStore.getState().uiDensity);
        appearancePatch.density = draftUiDensity;
      }
      const uiFontChanged = draftUiFontFamily !== savedBaseline.uiFontFamily;
      if (uiFontChanged) {
        const currentUiFont = usePreferencesStore.getState().uiFontFamily;
        if (currentUiFont !== savedBaseline.uiFontFamily && currentUiFont !== draftUiFontFamily)
          throw new Error('UI font changed in another window or editor. Reopen Preferences before applying your UI font draft');
        appearancePatch.uiFont = { fontFamily: draftUiFontFamily };
      }
      const themeModeChanged = draftThemeMode !== savedBaseline.themeMode;
      const currentThemeState = useThemeStore.getState?.();
      if (themeModeChanged) {
        if (currentThemeState?.themeMode !== undefined && currentThemeState.themeMode !== savedBaseline.themeMode && currentThemeState.themeMode !== draftThemeMode)
          throw new Error('Theme mode changed in another window. Reopen Preferences before applying');
        appearancePatch.themeMode = draftThemeMode;
      }
      if (draftDarkThemeId !== savedBaseline.darkThemeId) {
        const currentDarkThemeId = currentThemeState?.darkThemeId;
        if (currentDarkThemeId !== undefined && currentDarkThemeId !== savedBaseline.darkThemeId && currentDarkThemeId !== draftDarkThemeId)
          throw new Error('Dark theme changed in another window. Reopen Preferences before applying');
        appearancePatch.darkThemeId = draftDarkThemeId;
      }
      if (draftLightThemeId !== savedBaseline.lightThemeId) {
        const currentLightThemeId = currentThemeState?.lightThemeId;
        if (currentLightThemeId !== undefined && currentLightThemeId !== savedBaseline.lightThemeId && currentLightThemeId !== draftLightThemeId)
          throw new Error('Light theme changed in another window. Reopen Preferences before applying');
        appearancePatch.lightThemeId = draftLightThemeId;
      }
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
        additionalPreferences,
        languageDraft || densityChanged ? (settings) => {
          if (languageDraft) languagePreferencesPatch(languageDraft.value, languageDraft.baseline, readLanguagePreferences(settings));
          validateDensity(readUiDensity(settings));
        } : undefined,
      );
      await languageDraft?.acceptCommitted();
      aiDraftStore.getState().replace(committedAi);
      setAiBaseline(committedAi);
      const latestThemeState = useThemeStore.getState?.() ?? currentThemeState;
      const committedThemeMode = themeModeChanged ? draftThemeMode : latestThemeState?.themeMode ?? savedBaseline.themeMode;
      const themeSelection = {
        darkThemeId: draftDarkThemeId !== savedBaseline.darkThemeId
          ? draftDarkThemeId : latestThemeState?.darkThemeId ?? savedBaseline.darkThemeId ?? DEFAULT_THEMES.dark,
        lightThemeId: draftLightThemeId !== savedBaseline.lightThemeId
          ? draftLightThemeId : latestThemeState?.lightThemeId ?? savedBaseline.lightThemeId ?? DEFAULT_THEMES.light,
      };
      const resolvedTheme = resolveTheme(committedThemeMode, themeSelection);
      useThemeStore.setState({ ...themeSelection, themeMode: committedThemeMode, theme: resolvedTheme });
      applyThemeToDocument(resolvedTheme);
      persistThemeMode(committedThemeMode);
      persistThemeSelection(themeSelection);
      setDraftThemeMode?.(committedThemeMode);
      setDraftDarkThemeId?.(themeSelection.darkThemeId);
      setDraftLightThemeId?.(themeSelection.lightThemeId);
      const committedKeymap = keymapChanged ? draftKeymap : usePreferencesStore.getState().keymap ?? DEFAULT_KEYMAP;
      const committedUiDensity = densityChanged ? draftUiDensity : normalizeUiDensity(usePreferencesStore.getState().uiDensity);
      const committedUiFont = uiFontChanged ? draftUiFontFamily : usePreferencesStore.getState().uiFontFamily;
      usePreferencesStore.setState({
        keymap: committedKeymap,
        uiFontFamily: committedUiFont,
        uiDensity: committedUiDensity,
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
      applyUiDensityToDocument(committedUiDensity);
      applyMarkdownFontToDocument(markdownFontSettings);
      const needsRestart = titleBarChanged ||
        draftGitBinaryId !== savedBaseline.gitBinaryId ||
        draftGitBinaryPath !== savedBaseline.gitBinaryPath;
      const sandboxChanged = draftSandboxType !== savedBaseline.sandboxType;
      useGitStore.setState({ activeSandboxType: draftSandboxType });
      if (sandboxChanged) {
        const label =
          draftSandboxType === 'in_memory'
            ? i18n.t('ai.sandbox.adapters.inMemoryTitle')
            : draftSandboxType === 'local_worktree'
              ? i18n.t('ai.sandbox.adapters.worktreeTitle')
              : i18n.t('ai.sandbox.adapters.dockerTitle');
        showToast(i18n.t('git.toasts.sandboxSwitched', { label }));
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
        uiDensity: committedUiDensity,
        linuxTitleBar: titleBarChanged ? draftLinuxTitleBar : usePreferencesStore.getState().linuxTitleBar ?? 'system',
        themeMode: committedThemeMode,
        darkThemeId: themeSelection.darkThemeId,
        lightThemeId: themeSelection.lightThemeId,
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
      setDraftUiDensity?.(committedUiDensity);
      if (getApplicationServices().platform.capabilities.preferencesFile) {
        // Another window may commit while this response is in flight. Reconcile
        // local previews after publication, without treating a refresh failure
        // as a failed transaction that has already committed.
        try {
          const latest = await preferencesJsonService.load();
          if (latest.settings && !latest.validationError) synchronizeWorkspacePreferences(latest.settings);
        } catch {
          console.warn('Preferences committed; runtime refresh will retry on the next preference event.');
        }
      }
      setIsApplied(true);
      setTimeout(() => setIsApplied(false), 2000);
      showToast(i18n.t('preferences.appliedToast'));
      if (needsRestart) setShowRestartPrompt(true);
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error ?? '').trim();
      setApplyError(
        detail
          ? i18n.t('preferences.applyFailedWithDetail', { error: detail })
          : i18n.t('preferences.applyFailed')
      );
      return false;
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
    }
  };
  return handleApply;
}
