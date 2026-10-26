import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';
import { markdownPreferencesHarness } from './helpers/markdownPreferencesHarness.mjs';

const url = (path) => new URL(`../frontend/${path}`, import.meta.url);
function fixture() {
  const prefs = { keymap: { preset: 'stage0', overrides: [{ command: 'fetch', keys: ['CmdOrCtrl+F8'] }] },
    uiFontFamily: 'IBM Plex Sans', fontFamily: 'Fira Code', fontSize: 13, isBold: false,
    isItalic: false, isUnderline: false, lineSpacing: 1.5, enableLigatures: true,
    markdownFontFamily: 'Arial', markdownCodeFontFamily: 'Fira Code', markdownEditorFontFamily: 'Fira Code',
    markdownFontSize: 14, markdownHeadingFontWeight: 600 };
  const patches = [], previews = [];
  const theme = { themeMode: 'system', theme: 'mocha' }, persistedModes = [];
  let fail = false, paused;
  const service = loadWithMocks(url('features/onboarding/services/onboardingPreferences.ts'), {
    '../../../core/store/useThemeStore': {
      useThemeStore: { getState: () => theme, setState: (patch) => Object.assign(theme, patch) },
      resolveTheme: (mode) => mode === 'light' ? 'mocha-light' : 'mocha',
      applyThemeToDocument: (value) => previews.push(['theme', value]),
      persistThemeMode: (mode) => persistedModes.push(mode),
    },
    '../../preferences/store/usePreferencesStore': { usePreferencesStore: {
      getState: () => prefs, setState: (patch) => Object.assign(prefs, patch),
    }, applyViewerFontToDocument: (settings) => previews.push(['buffer', settings]) },
    '../../preferences/utils/applyMarkdownFontToDocument': { applyMarkdownFontToDocument: (settings) => previews.push(['markdown', settings]) },
    '../../preferences/utils/applyUiFontToDocument': { applyUiFontToDocument: (font) => previews.push(['ui', font]) },
    '../../preferences/services/preferencesJsonService': { preferencesJsonService: { patch: async (patch) => {
      patches.push(structuredClone(patch)); if (paused) await paused; if (fail) throw Error('Disk unavailable');
    } } },
  });
  const baseline = service.captureOnboardingPreferences();
  return { prefs, theme, persistedModes, patches, previews, service, baseline, draft: structuredClone(baseline),
    fail: () => { fail = true; }, pause: (promise) => { paused = promise; } };
}

test('welcome keeps Theme before Keymaps and ends with AI setup then Startup then Open/Clone', () => {
  const { WELCOME_SLIDES } = loadWithMocks(url('features/onboarding/constants/welcomeSlides.ts'), {});
  assert.deepEqual(WELCOME_SLIDES.map((slide) => slide.id),
    ['welcome', 'compare', 'review', 'theme', 'keymaps', 'ui-font', 'buffer-font', 'markdown-font', 'ai-setup', 'startup', 'repository']);
});

test('onboarding startup tab toggles launch on boot and start in background', async (t) => {
  const runner = componentHarness();
  t.after(() => runner.cleanup());
  const { WelcomeStartupTab } = loadWithMocks(url('features/onboarding/components/WelcomeStartupTab.tsx'), {
    react: runner.react,
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ platform: { capabilities: { backend: true } } }) },
  });
  const props = { settings: fixture().draft, onChange(fn) { props.settings = fn(props.settings); } };
  assert.equal(props.settings.launchAtStartup, true);
  assert.equal(props.settings.startInBackground, false);
  const tree = await runner.render(WelcomeStartupTab, props);
  const switch1 = componentNodes(tree).find((node) => node.props.id === 'onboarding-launch-at-startup' && node.type === 'button');
  const switch2 = componentNodes(tree).find((node) => node.props.id === 'onboarding-start-in-background' && node.type === 'button');
  assert.ok(switch1 && switch2);
  assert.equal(switch1.props['aria-checked'], true);
  assert.equal(switch2.props['aria-checked'], false);
  switch1.props.onClick();
  assert.equal(props.settings.launchAtStartup, false);
  switch2.props.onClick();
  assert.equal(props.settings.startInBackground, true);
});

test('onboarding UI font picker delegates font choice and defaults to standard downward placement', async (t) => {
  const runner = componentHarness();
  t.after(() => runner.cleanup());
  const PreferencesUiFontTab = () => null;
  const { WelcomeSettingsPanel } = loadWithMocks(url('features/onboarding/components/WelcomeSettingsPanel.tsx'), {
    react: runner.react,
    '../../preferences/components/tabs/PreferencesUiFontTab': { PreferencesUiFontTab },
    '../../preferences/components/tabs/PreferencesFontTab': { PreferencesFontTab: () => null },
    '../../preferences/components/tabs/PreferencesMarkdownFontTab': { PreferencesMarkdownFontTab: () => null },
    '../../preferences/components/keymaps/KeymapPresetPicker': { KeymapPresetPicker: () => null },
    './WelcomeThemePicker': { WelcomeThemePicker: () => null },
    './WelcomeStartupTab': { WelcomeStartupTab: () => null },
  });
  const tree = await runner.render(WelcomeSettingsPanel, {
    step: 'ui-font', settings: fixture().draft, onChange() {},
  });
  const picker = componentNodes(tree).find((node) => node.type === PreferencesUiFontTab);
  assert.equal(picker.props.value, fixture().draft.uiFontFamily);
  assert.equal(picker.props.dropdownPlacement, undefined);
});

test('onboarding buffer font step renders simplified tab with family, line spacing, and ligatures only', async (t) => {
  const runner = componentHarness();
  t.after(() => runner.cleanup());
  const PreferencesFontTab = () => null;
  const { WelcomeSettingsPanel } = loadWithMocks(url('features/onboarding/components/WelcomeSettingsPanel.tsx'), {
    react: runner.react,
    '../../preferences/components/tabs/PreferencesUiFontTab': { PreferencesUiFontTab: () => null },
    '../../preferences/components/tabs/PreferencesFontTab': { PreferencesFontTab },
    '../../preferences/components/tabs/PreferencesMarkdownFontTab': { PreferencesMarkdownFontTab: () => null },
    '../../preferences/components/keymaps/KeymapPresetPicker': { KeymapPresetPicker: () => null },
    './WelcomeThemePicker': { WelcomeThemePicker: () => null },
    './WelcomeStartupTab': { WelcomeStartupTab: () => null },
  });
  const draft = fixture().draft;
  const tree = await runner.render(WelcomeSettingsPanel, {
    step: 'buffer-font', settings: draft, onChange() {},
  });
  const tab = componentNodes(tree).find((node) => node.type === PreferencesFontTab);
  assert.ok(tab, 'Buffer font tab should be rendered');
  assert.equal(tab.props.simplified, true);
  assert.equal(tab.props.draftFontFamily, draft.viewerFont.fontFamily);
  assert.equal(tab.props.draftLineSpacing, draft.viewerFont.lineSpacing);
  assert.equal(tab.props.draftEnableLigatures, draft.viewerFont.enableLigatures);
  assert.equal(tab.props.draftFontSize, undefined);
  assert.equal(tab.props.draftIsBold, undefined);
  assert.equal(tab.props.draftIsItalic, undefined);
  assert.equal(tab.props.draftIsUnderline, undefined);
});

test('appearance and keymap steps remain optional once required AI setup is saved', async (t) => {
  const f = fixture(), runner = componentHarness(), stored = new Map();
  const previousWindow = globalThis.window, previousStorage = globalThis.localStorage;
  globalThis.window = { location: { search: '' }, addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage = { getItem: (key) => stored.get(key), setItem: (key, value) => stored.set(key, value) };
  t.after(() => {
    runner.cleanup();
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = previousStorage;
  });
  let completed = 0;
  const { FirstLaunchWelcome } = loadWithMocks(url('features/onboarding/components/FirstLaunchWelcome.tsx'), {
    react: runner.react,
    '@tauri-apps/api/core': { invoke: async () => {} },
    '../../../common/components/icons/ArrowRight': { ArrowRight: () => null },
    '../../../common/components/icons/X': { X: () => null },
    '../../../common/components/AppLogo': { AppLogo: () => null },
    '../../../common/utils/shortcuts': { isMacOS: () => true },
    '../../git/store/useGitStore': { useGitStore: { getState: () => ({}) } },
    './BranchArtwork': { BranchArtwork: () => null },
    './CompareArtwork': { CompareArtwork: () => null },
    './ReviewArtwork': { ReviewArtwork: () => null },
    './WelcomeSettingsPanel': { WelcomeSettingsPanel: () => null },
    './WelcomeSettingsPreview': { WelcomeSettingsPreview: () => null },
    './WelcomeAiSetup': { WelcomeAiSetup: () => null },
    '../hooks/useOnboardingAiSetup': { useOnboardingAiSetup: () => ({ connections: ['Saved ACP'], busy: false, canFinish: () => true }) },
    '../hooks/useOnboardingPreferences': { useOnboardingPreferences: () => ({
      settings: f.draft, setSettings: () => assert.fail('No settings should be chosen'),
      isSaving: false, saveError: null, reload() {},
      save: async () => { await f.service.saveOnboardingPreferences(f.draft, f.baseline); return true; },
    }) },
  });
  const render = () => runner.render(FirstLaunchWelcome, { onComplete: () => { completed++; } });
  const { WELCOME_SLIDES } = loadWithMocks(url('features/onboarding/constants/welcomeSlides.ts'), {});
  let tree = await render();
  const dragRegion = componentNodes(tree).find((node) => Object.hasOwn(node.props, 'data-tauri-drag-region'));
  assert.ok(dragRegion, 'The title strip must remain draggable');
  assert.match(dragRegion.props.className, /\bcursor-default\b/);
  assert.ok(!dragRegion.props.className.includes('cursor-move'),
    'The onboarding title strip must not leak a move cursor over native window controls');
  const dialog = componentNodes(tree).find((node) => node.props.role === 'dialog');
  assert.equal(dialog.props.tabIndex, -1, 'Initial focus belongs to the dialog, not a call-to-action');
  assert.match(dialog.props.className, /\bh-full\b.*\bw-full\b/);
  assert.match(dialog.props.className, /\brounded-none\b/, 'Onboarding is the full window, not an inset card');
  assert.ok(!dialog.props.className.includes('max-w-') && !dialog.props.className.includes('max-h-'),
    'Do not restore an outer gutter or bounded card around the tour');
  assert.ok(componentNodes(tree).some((node) => node.props.className?.includes('my-auto py-8')),
    'Intro copy should be vertically balanced instead of pinned far above its navigation');
  for (let slide = 0; slide < WELCOME_SLIDES.length - 1; slide++) {
    const visibleText = componentNodes(tree).map((node) => node.props.children
      .filter((child) => typeof child === 'string' || typeof child === 'number').join(''));
    assert.ok(!visibleText.some((text) => /^0?\d+\s*\/\s*0?\d+$/.test(text.trim()) || /-step welcome guide/.test(text)),
      'Step counters must not be visible on the onboarding screen');
    const nextLabel = slide === 2 ? "Let's get started" : 'Next';
    const next = componentNodes(tree).find((node) => node.type === 'button' && node.props.children.flat().some((child) => typeof child === 'string' && child.trim() === nextLabel));
    assert.ok(next, `Step ${slide + 1} must allow Next without choosing anything`);
    assert.ok(!next.props.disabled);
    assert.ok(!componentNodes(tree).some((node) => node.type === 'button' &&
      node.props.children.includes('Open a repository')), 'Repository actions belong to the final step only');
    assert.equal(next.props.ref, undefined, 'Next must not receive automatic focus');
    if (slide === 2) {
      assert.ok(next.props.className.includes('btn-primary'), "Let's get started must use the brand button");
    } else {
      assert.ok(!next.props.className.includes('btn-primary'), 'Next must not use the glowing brand button');
      assert.match(next.props.className, /\bbg-surface0\b/);
      assert.match(next.props.className, /\btext-text\b/);
      assert.match(next.props.className, /\bborder-0\b/);
    }
    assert.notEqual(next.props.tabIndex, -1, 'Next remains available to keyboard navigation');
    next.props.onClick(); tree = await render();
  }
  const finalNodes = componentNodes(tree);
  assert.ok(finalNodes.some((node) => node.type === 'h1' && node.props.children.includes('Start with a repository')));
  assert.ok(finalNodes.some((node) => node.type === 'button' && node.props.children.includes('Open a repository')));
  const clone = finalNodes.find((node) => node.type === 'button' && node.props.children.includes('Clone a repository'));
  assert.ok(clone);
  assert.ok(!clone.props.className.split(/\s+/).includes('hidden'), 'Clone stays available on narrow windows');
  assert.ok(!finalNodes.some((node) => node.type === 'p' && node.props.children.some((child) =>
    typeof child === 'string' && child.includes('Optional — everything is already set up.'))));
  const skip = componentNodes(tree).find((node) => node.type === 'button' && node.props.children.includes('Skip tour'));
  await skip.props.onClick();
  assert.equal(completed, 1);
  assert.equal(stored.get('stage0_first_launch_welcome_v1'), 'completed');
  assert.equal(f.patches.length, 0, 'Keeping defaults must not require a preferences write');
  assert.deepEqual(f.service.captureOnboardingPreferences(), f.baseline);
});

test('onboarding saves one minimal patch and activates choices only after success', async () => {
  const f = fixture(); let release;
  f.draft.keymap.preset = 'fork'; f.draft.uiFontFamily = 'Inter';
  f.draft.viewerFont.fontSize = 16; f.draft.markdownFont.editorFontFamily = 'Consolas';
  f.pause(new Promise((resolve) => { release = resolve; }));
  const pending = f.service.saveOnboardingPreferences(f.draft, f.baseline);
  assert.deepEqual(f.patches, [{ keymap: f.draft.keymap, appearance: {
    uiFont: { fontFamily: 'Inter' }, viewerFont: { fontSize: 16 }, markdownFont: { editorFontFamily: 'Consolas' },
  } }]);
  assert.equal(f.prefs.keymap.preset, 'stage0'); assert.equal(f.prefs.fontSize, 13);
  release(); await pending;
  assert.equal(f.prefs.keymap.preset, 'fork'); assert.equal(f.prefs.uiFontFamily, 'Inter');
  assert.equal(f.prefs.fontSize, 16); assert.equal(f.prefs.markdownEditorFontFamily, 'Consolas');
  assert.deepEqual(f.prefs.keymap.overrides, f.baseline.keymap.overrides);
  assert.equal(f.prefs.markdownFontFamily, 'Arial');
  assert.deepEqual(f.previews.at(-3), ['ui', 'Inter']);
});

test('theme previews immediately but commits its preference and startup cache only after saving', async () => {
  const f = fixture(); f.draft.themeMode = 'light';
  f.service.previewOnboardingPreferences(f.draft);
  assert.deepEqual(f.previews[0], ['theme', 'mocha-light']);
  assert.equal(f.theme.themeMode, 'system'); assert.deepEqual(f.persistedModes, []);
  let release; f.pause(new Promise((resolve) => { release = resolve; }));
  const pending = f.service.saveOnboardingPreferences(f.draft, f.baseline);
  assert.deepEqual(f.patches, [{ appearance: { themeMode: 'light' } }]);
  assert.equal(f.theme.themeMode, 'system');
  release(); await pending;
  assert.deepEqual(f.theme, { themeMode: 'light', theme: 'mocha-light' });
  assert.deepEqual(f.persistedModes, ['light']);
  assert.equal(f.prefs.fontFamily, 'Fira Code');
});

test('failed theme saves retain the committed theme and detect conflicts without overwriting external choices', async () => {
  const f = fixture(); f.draft.themeMode = 'dark'; f.fail();
  await assert.rejects(f.service.saveOnboardingPreferences(f.draft, f.baseline), /Disk unavailable/);
  assert.equal(f.theme.themeMode, 'system'); assert.deepEqual(f.persistedModes, []);
  const conflict = fixture(); conflict.draft.themeMode = 'dark'; conflict.theme.themeMode = 'light';
  await assert.rejects(conflict.service.saveOnboardingPreferences(conflict.draft, conflict.baseline), /another window/);
  assert.equal(conflict.theme.themeMode, 'light'); assert.equal(conflict.patches.length, 0);
  const unrelated = fixture(); unrelated.theme.themeMode = 'light'; unrelated.draft.viewerFont.fontSize = 16;
  await unrelated.service.saveOnboardingPreferences(unrelated.draft, unrelated.baseline);
  assert.equal(unrelated.theme.themeMode, 'light');
  assert.deepEqual(unrelated.patches, [{ appearance: { viewerFont: { fontSize: 16 } } }]);
});

test('leaving an uncommitted theme preview restores the currently saved theme', () => {
  const f = fixture(), runner = hookHarness();
  const { useOnboardingPreferences } = loadWithMocks(url('features/onboarding/hooks/useOnboardingPreferences.ts'), {
    react: runner.react, '../services/onboardingPreferences': f.service,
  });
  let state = runner.render(useOnboardingPreferences);
  state.setSettings((previous) => ({ ...previous, themeMode: 'light' }));
  state = runner.render(useOnboardingPreferences);
  assert.deepEqual(f.previews.at(-4), ['theme', 'mocha-light']);
  assert.equal(f.theme.themeMode, 'system');
  runner.cleanup(); assert.deepEqual(f.previews.at(-4), ['theme', 'mocha']);
  assert.deepEqual(f.persistedModes, []);
});

test('theme picker offers System, Light and Dark, with System selected by default', async () => {
  const f = fixture(), runner = componentHarness();
  const { WelcomeThemePicker } = loadWithMocks(url('features/onboarding/components/WelcomeThemePicker.tsx'), {
    react: runner.react,
    '../../../common/components/icons/Monitor': { Monitor: () => null },
    '../../../common/components/icons/Sun': { Sun: () => null },
    '../../../common/components/icons/Moon': { Moon: () => null },
    '../../../common/components/icons/Check': { Check: () => null },
  });
  const props = { settings: f.draft, onChange: (next) => { props.settings = next(props.settings); } };
  let buttons = componentNodes(await runner.render(WelcomeThemePicker, props)).filter((node) => node.type === 'button');
  assert.equal(buttons.length, 3); assert.equal(buttons[0].props['aria-pressed'], true);
  buttons[1].props.onClick();
  buttons = componentNodes(await runner.render(WelcomeThemePicker, props)).filter((node) => node.type === 'button');
  assert.equal(props.settings.themeMode, 'light'); assert.equal(buttons[1].props['aria-pressed'], true);
  assert.equal(buttons[0].props['aria-pressed'], false); assert.equal(f.theme.themeMode, 'system');
  runner.cleanup();
});

test('unchanged onboarding does not write preferences and failures retain the committed values', async () => {
  const f = fixture();
  await f.service.saveOnboardingPreferences(f.draft, f.baseline);
  assert.equal(f.patches.length, 0);
  f.draft.uiFontFamily = 'Arial'; f.fail();
  await assert.rejects(f.service.saveOnboardingPreferences(f.draft, f.baseline), /Disk unavailable/);
  assert.equal(f.prefs.uiFontFamily, 'IBM Plex Sans'); assert.equal(f.previews.length, 0);
});

test('onboarding preserves unrelated external changes and refuses overlapping edits', async () => {
  const f = fixture(); f.draft.viewerFont.fontSize = 16;
  f.prefs.markdownFontFamily = 'Georgia'; f.prefs.isBold = true;
  await f.service.saveOnboardingPreferences(f.draft, f.baseline);
  assert.equal(f.prefs.markdownFontFamily, 'Georgia'); assert.equal(f.prefs.isBold, true);
  const conflict = fixture(); conflict.draft.uiFontFamily = 'Inter'; conflict.prefs.uiFontFamily = 'Arial';
  await assert.rejects(conflict.service.saveOnboardingPreferences(conflict.draft, conflict.baseline), /another window/);
  assert.equal(conflict.patches.length, 0); assert.equal(conflict.prefs.uiFontFamily, 'Arial');
});

test('onboarding hook previews drafts, blocks concurrent saves, reports failures and restores fonts on unmount', async () => {
  const f = fixture(), runner = hookHarness();
  const { useOnboardingPreferences } = loadWithMocks(url('features/onboarding/hooks/useOnboardingPreferences.ts'), {
    react: runner.react, '../services/onboardingPreferences': f.service,
  });
  let state = runner.render(useOnboardingPreferences);
  state.setSettings((previous) => ({ ...previous, uiFontFamily: 'Inter' }));
  state = runner.render(useOnboardingPreferences);
  assert.equal(f.patches.length, 0); assert.equal(f.previews.at(-3)[1], 'Inter');
  let release; f.pause(new Promise((resolve) => { release = resolve; })); f.fail();
  const pending = state.save(); assert.equal(await state.save(), false);
  release(); assert.equal(await pending, false);
  state = runner.render(useOnboardingPreferences);
  assert.match(state.saveError, /Disk unavailable/); assert.equal(state.settings.uiFontFamily, 'Inter');
  state.reload(); state = runner.render(useOnboardingPreferences);
  assert.equal(state.settings.uiFontFamily, 'IBM Plex Sans'); assert.equal(state.saveError, null);
  runner.cleanup(); assert.equal(f.previews.at(-3)[1], 'IBM Plex Sans');
});

test('preset buttons show distinct brand logos and names, expose selection, and preserve custom bindings', async () => {
  const runner = componentHarness(); let value = fixture().baseline.keymap;
  const KeymapPresetLogo = () => null;
  const { KeymapPresetPicker } = loadWithMocks(url('features/preferences/components/keymaps/KeymapPresetPicker.tsx'), {
    react: runner.react, './KeymapPresetLogo': { KeymapPresetLogo },
    '../../../../common/components/icons/Check': { Check: () => null },
  });
  let nodes = componentNodes(await runner.render(KeymapPresetPicker, { value, onChange: (next) => { value = next; } }));
  const buttons = nodes.filter((node) => node.type === 'button');
  assert.equal(buttons.length, 7);
  const logos = nodes.filter((node) => node.type === KeymapPresetLogo);
  assert.equal(logos.length, 7);
  assert.deepEqual(logos.map((node) => node.props.preset), ['stage0', 'vscode', 'jetbrains', 'github-desktop', 'fork', 'sourcetree', 'gitkraken']);
  assert.equal(buttons.filter((node) => node.props['aria-pressed']).length, 1);
  const fork = buttons.find((node) => node.props.children.some((child) => child?.props?.children?.includes('Fork')));
  fork.props.onClick(); assert.equal(value.preset, 'fork');
  assert.deepEqual(value.overrides, [{ command: 'fetch', keys: ['CmdOrCtrl+F8'] }]);
  nodes = componentNodes(await runner.render(KeymapPresetPicker, { value, onChange() {} }));
  assert.equal(nodes.filter((node) => node.type === 'button' && node.props['aria-pressed']).length, 1);
  runner.cleanup();
});

test('UI font joins Preferences Apply/Cancel/reset and remains independent of buffer/Markdown fonts', async (t) => {
  const f = markdownPreferencesHarness(); t.after(f.cleanup);
  let state = f.render(); state.appearance.setDraftUiFontFamily('Inter'); state = f.render();
  assert.equal(state.transaction.totalUnsaved, 1); assert.equal(f.preferences.uiFontFamily, 'IBM Plex Sans');
  assert.equal(await state.transaction.handleApply(), true);
  assert.deepEqual(f.patches, [{ appearance: { uiFont: { fontFamily: 'Inter' } } }]);
  assert.equal(f.preferences.uiFontFamily, 'Inter'); assert.equal(f.preferences.fontFamily, 'Fira Code');
  state = f.render(); state.appearance.setDraftUiFontFamily('Arial'); state = f.render();
  state.transaction.handleCancel(); assert.equal(f.preferences.uiFontFamily, 'Inter');
  f.render(); f.preferences.isPreferencesOpen = true; f.render(); state = f.render();
  assert.equal(state.appearance.draftUiFontFamily, 'Inter');
  state.transaction.handleResetDefaults(); state = f.render();
  assert.equal(state.appearance.draftUiFontFamily, 'IBM Plex Sans');
  assert.equal(f.preferences.uiFontFamily, 'Inter');
});

test('Preferences preserves external UI font changes and rejects conflicting UI font drafts', async (t) => {
  const unrelated = markdownPreferencesHarness(); t.after(unrelated.cleanup);
  let state = unrelated.render(); state.appearance.setDraftMarkdownFontSize(16);
  unrelated.preferences.uiFontFamily = 'Arial'; state = unrelated.render();
  assert.equal(await state.transaction.handleApply(), true);
  assert.equal(unrelated.preferences.uiFontFamily, 'Arial');
  const conflict = markdownPreferencesHarness(); t.after(conflict.cleanup);
  state = conflict.render(); state.appearance.setDraftUiFontFamily('Inter');
  conflict.preferences.uiFontFamily = 'Arial'; state = conflict.render();
  assert.equal(await state.transaction.handleApply(), false);
  assert.equal(conflict.patches.length, 0); assert.equal(conflict.preferences.uiFontFamily, 'Arial');
});
