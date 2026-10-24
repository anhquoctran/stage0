import { loadWithMocks } from './componentHarness.mjs';
import { hookHarness } from './hookHarness.mjs';

// Exercise the actual draft session, dirty counter and Apply closure together.
export function markdownPreferencesHarness() {
  const runner = hookHarness();
  const patches = [], previews = [];
  const viewerFont = { fontFamily: 'Fira Code', fontSize: 13, isBold: false,
    isItalic: false, isUnderline: false, lineSpacing: 1.5, enableLigatures: true };
  const markdownFont = { fontFamily: 'Arial', codeFontFamily: 'Fira Code',
    editorFontFamily: 'Fira Code', fontSize: 14, headingFontWeight: 600 };
  const preferences = { ...viewerFont, isPreferencesOpen: true,
    uiFontFamily: 'IBM Plex Sans',
    keymap: { preset: 'stage0', overrides: [] }, showInlineBlame: true,
    markdownFontFamily: markdownFont.fontFamily, markdownCodeFontFamily: markdownFont.codeFontFamily,
    markdownEditorFontFamily: markdownFont.editorFontFamily, markdownFontSize: markdownFont.fontSize,
    markdownHeadingFontWeight: markdownFont.headingFontWeight,
    setIsPreferencesOpen: (value) => { preferences.isPreferencesOpen = value; },
    setInitialPreferencesTab() {}, initialPreferencesTab: null };
  const stateStore = (state) => Object.assign(() => state, {
    getState: () => state,
    setState: (patch) => Object.assign(state, typeof patch === 'function' ? patch(state) : patch),
  });
  const snapshot = { aiConfig: {}, mcpServers: [], globalReviewers: [], externalAgents: [], guardrailPolicy: {} };
  const git = { activeSandboxType: 'in_memory', showToast() {}, refreshDiff() {} };
  const binaries = { activeBinaryId: 'system', activeBinaryPath: 'git', binaries: [],
    fetchActiveBinary: async () => ({ id: 'system', path: 'git' }) };
  let failure = false, paused;
  const { usePreferencesDraft } = loadWithMocks(
    new URL('../../frontend/features/preferences/hooks/usePreferencesDraft.ts', import.meta.url),
    {
      react: runner.react,
      '../../../core/store/useThemeStore': {
        useThemeStore: stateStore({ themeMode: 'system' }),
        resolveTheme: () => 'dark', applyThemeToDocument() {}, persistThemeMode() {},
      },
      '../store/usePreferencesStore': {
        usePreferencesStore: stateStore(preferences), DEFAULT_VIEWER_FONT_SETTINGS: viewerFont,
        applyViewerFontToDocument() {},
      },
      '../utils/applyMarkdownFontToDocument': {
        applyMarkdownFontToDocument: (settings) => previews.push({ ...settings }),
      },
      '../../git/store/useGitStore': { useGitStore: stateStore(git) },
      '../../git/store/useGitBinaryStore': { useGitBinaryStore: stateStore(binaries) },
      '../../ai/services/commitAiPreferences': {
        captureAiPreferences: () => snapshot,
        commitAiPreferences: async (_, __, patch) => {
          patches.push(structuredClone(patch));
          if (paused) await paused;
          if (failure) throw Error('Disk unavailable');
          return snapshot;
        },
      },
      '../../ai/store/createAiPreferencesDraft': {
        createAiPreferencesDraft: () => {
          const state = { ...snapshot, replace(next) { Object.assign(state, next); }, updateAiConfig() {} };
          return stateStore(state);
        },
      },
      '../../ai/utils/aiPreferencesSnapshot': { aiPreferencesChangeCount: () => 0 },
      './usePreferencesNavigation': { usePreferencesNavigation: () => ({
        setSearchQuery() {}, setActiveTab() {}, setExpandedGroups() {}, activeTab: 'appearance-markdown-font',
        searchQuery: '', expandedGroups: {}, filteredTree: [], toggleGroup() {}, currentChildItem: null,
      }) },
    },
  );
  const render = () => runner.render(usePreferencesDraft);
  render();
  return { render, preferences, patches, previews, markdownFont,
    fail: () => { failure = true; }, pause: (promise) => { paused = promise; },
    cleanup: () => runner.cleanup() };
}
