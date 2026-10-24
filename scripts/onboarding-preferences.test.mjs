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
  let fail = false, paused;
  const service = loadWithMocks(url('features/onboarding/services/onboardingPreferences.ts'), {
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
  return { prefs, patches, previews, service, baseline, draft: structuredClone(baseline),
    fail: () => { fail = true; }, pause: (promise) => { paused = promise; } };
}

test('welcome includes the three intro slides and four configuration steps', () => {
  const { WELCOME_SLIDES } = loadWithMocks(url('features/onboarding/constants/welcomeSlides.ts'), {});
  assert.deepEqual(WELCOME_SLIDES.map((slide) => slide.id),
    ['welcome', 'compare', 'review', 'keymaps', 'ui-font', 'buffer-font', 'markdown-font']);
});

test('every welcome step can be continued and the guide completed without selecting any settings', async (t) => {
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
    '../../../common/components/icons/Sparkles': { Sparkles: () => null },
    '../../../common/components/icons/X': { X: () => null },
    '../../../common/components/AppLogo': { AppLogo: () => null },
    '../../../common/utils/shortcuts': { isMacOS: () => true },
    '../../git/store/useGitStore': { useGitStore: { getState: () => ({}) } },
    './BranchArtwork': { BranchArtwork: () => null },
    './CompareArtwork': { CompareArtwork: () => null },
    './ReviewArtwork': { ReviewArtwork: () => null },
    './WelcomeSettingsPanel': { WelcomeSettingsPanel: () => null },
    './WelcomeSettingsPreview': { WelcomeSettingsPreview: () => null },
    '../hooks/useOnboardingPreferences': { useOnboardingPreferences: () => ({
      settings: f.draft, setSettings: () => assert.fail('No settings should be chosen'),
      isSaving: false, saveError: null, reload() {},
      save: async () => { await f.service.saveOnboardingPreferences(f.draft, f.baseline); return true; },
    }) },
  });
  const render = () => runner.render(FirstLaunchWelcome, { onComplete: () => { completed++; } });
  let tree = await render();
  for (let slide = 0; slide < 6; slide++) {
    const next = componentNodes(tree).find((node) => node.type === 'button' && node.props.children.flat().some((child) => typeof child === 'string' && child.trim() === 'Next'));
    assert.ok(next, `Step ${slide + 1} must allow Next without choosing anything`);
    assert.ok(!next.props.disabled);
    next.props.onClick(); tree = await render();
  }
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

test('preset buttons show branch icons and names, expose selection, and preserve custom bindings', async () => {
  const runner = componentHarness(); let value = fixture().baseline.keymap;
  const GitBranch = () => null;
  const { KeymapPresetPicker } = loadWithMocks(url('features/preferences/components/keymaps/KeymapPresetPicker.tsx'), {
    react: runner.react, '../../../../common/components/icons/GitBranch': { GitBranch },
    '../../../../common/components/icons/Check': { Check: () => null },
  });
  let nodes = componentNodes(await runner.render(KeymapPresetPicker, { value, onChange: (next) => { value = next; } }));
  const buttons = nodes.filter((node) => node.type === 'button');
  assert.equal(buttons.length, 7); assert.equal(nodes.filter((node) => node.type === GitBranch).length, 7);
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
