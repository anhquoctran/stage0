import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';

const url = (path) => new URL(`../frontend/features/preferences/${path}`, import.meta.url);
function catalog(invoke, native = true) {
  return loadWithMocks(url('services/systemFontCatalog.ts'), {
    '@tauri-apps/api/core': { invoke, isTauri: () => native },
  });
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('native font catalog contains only discovered families and real bundled fonts, with single-flight requests', async () => {
  let release, calls = 0;
  const service = catalog((command) => {
    assert.equal(command, 'list_system_font_families'); calls++;
    return new Promise((resolve) => { release = resolve; });
  });
  assert.deepEqual(service.availableUiFontFamilies(), ['IBM Plex Sans', 'Inter Variable', 'Roboto Variable', 'Fira Code']);
  const first = service.loadSystemFontFamilies(), second = service.loadSystemFontFamilies();
  assert.equal(first, second); assert.equal(calls, 1);
  release(['My Installed UI', ' My Installed UI ', 'my installed ui', 'IBM Plex Sans', 'JetBrains Mono', '.Private Font']);
  assert.deepEqual(await first, ['IBM Plex Sans', 'Inter Variable', 'Roboto Variable', 'My Installed UI', 'Fira Code', 'JetBrains Mono']);
  assert.ok(!service.availableUiFontFamilies().includes('Inter'));
  const refreshed = service.loadSystemFontFamilies(); assert.equal(calls, 2);
  release(['New Installed Family']); await refreshed;
  assert.ok(service.availableUiFontFamilies().includes('New Installed Family'));
  assert.ok(!service.availableUiFontFamilies().includes('My Installed UI'));
});

test('font metadata normalization rejects invalid and private names without guessing missing fonts', () => {
  const service = catalog(async () => []);
  assert.deepEqual(service.normalizeFontFamilies([' Real Font ', 'real font', '', '.Hidden', 'Bad\nName',
    'x'.repeat(129), '字体'.repeat(30), null, 123, 'Actual Unicode 字体']), ['Actual Unicode 字体', 'Real Font']);
  assert.throws(() => service.normalizeFontFamilies({}), /invalid list/);
});

test('browser enumeration requests permission only on explicit load and uses family metadata', async (t) => {
  const previous = globalThis.window; let requests = 0;
  globalThis.window = { queryLocalFonts: async () => { requests++; return [
    { family: 'Browser Installed UI', fullName: 'Browser Installed UI Bold' },
    { family: 'Browser Installed UI', fullName: 'Browser Installed UI Italic' },
  ]; } };
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  const service = catalog(() => assert.fail('Browser must not call native IPC'), false);
  assert.equal(service.browserFontDiscoveryAvailable(), true);
  assert.deepEqual(await service.loadSystemFontFamilies(), ['IBM Plex Sans', 'Inter Variable', 'Roboto Variable', 'Fira Code']);
  assert.equal(requests, 0);
  const fonts = await service.loadSystemFontFamilies(true);
  assert.equal(requests, 1); assert.ok(fonts.includes('Browser Installed UI'));
  assert.ok(!fonts.includes('Browser Installed UI Bold'));
});

test('font discovery denial or unavailable APIs never falls back to invented platform lists', async (t) => {
  const previous = globalThis.window;
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  globalThis.window = { queryLocalFonts: async () => { throw Error('Permission denied'); } };
  const denied = catalog(async () => [], false);
  await assert.rejects(denied.loadSystemFontFamilies(true), /Permission denied/);
  assert.deepEqual(denied.availableUiFontFamilies(), ['IBM Plex Sans', 'Inter Variable', 'Roboto Variable', 'Fira Code']);
  globalThis.window = {};
  const unsupported = catalog(async () => [], false);
  assert.equal(unsupported.browserFontDiscoveryAvailable(), false);
  await assert.rejects(unsupported.loadSystemFontFamilies(true), /desktop app/);
  assert.deepEqual(unsupported.availableUiFontFamilies(), ['IBM Plex Sans', 'Inter Variable', 'Roboto Variable', 'Fira Code']);
});

test('font hook ignores late results, exposes failures, and permits retry without mutating preferences', async () => {
  const runner = hookHarness(), pending = [];
  const { useSystemFontFamilies } = loadWithMocks(url('hooks/useSystemFontFamilies.ts'), {
    react: runner.react,
    '@tauri-apps/api/core': { isTauri: () => true },
    '../services/systemFontCatalog': {
      availableUiFontFamilies: () => ['IBM Plex Sans'], browserFontDiscoveryAvailable: () => false,
      loadSystemFontFamilies: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    },
  });
  let state = runner.render(useSystemFontFamilies);
  const refresh = state.refresh();
  pending[1].resolve(['IBM Plex Sans', 'Latest System UI']); await refresh;
  pending[0].resolve(['Stale System UI']); await tick(); state = runner.render(useSystemFontFamilies);
  assert.deepEqual(state.families, ['IBM Plex Sans', 'Latest System UI']);
  const failed = state.refresh(); pending[2].reject(Error('Native failure')); await failed;
  state = runner.render(useSystemFontFamilies); assert.match(state.error, /Native failure/);
  const retry = state.refresh(); pending[3].resolve(['IBM Plex Sans', 'Recovered UI']); await retry;
  state = runner.render(useSystemFontFamilies); assert.equal(state.error, null);
  assert.deepEqual(state.families, ['IBM Plex Sans', 'Recovered UI']);
  const late = state.refresh(); runner.cleanup(); pending[4].resolve(['Too late']); await late;
  state = runner.render(useSystemFontFamilies);
  assert.deepEqual(state.families, ['IBM Plex Sans', 'Recovered UI']);
});

test('UI font picker labels bundled/system sources and disables a missing saved family', async (t) => {
  const runner = componentHarness(), changes = [], refreshes = [];
  t.after(() => runner.cleanup());
  const state = { families: ['IBM Plex Sans', 'Inter Variable', 'Roboto Variable', 'Real Installed UI', 'Fira Code', 'JetBrains Mono'], isLoading: false,
    error: null, native: true, canDiscover: true, refresh: async (explicit) => refreshes.push(explicit) };
  const { PreferencesUiFontTab } = loadWithMocks(url('components/tabs/PreferencesUiFontTab.tsx'), {
    react: runner.react,
    '../../../../common/components/CustomSelect': { CustomSelect: () => null },
    '../../hooks/useSystemFontFamilies': { useSystemFontFamilies: () => state },
    '../../utils/applyUiFontToDocument': { applyUiFontToDocument() {} },
  });
  const props = { value: 'Missing Saved Family', onChange: (value) => changes.push(value) };
  let nodes = componentNodes(await runner.render(PreferencesUiFontTab, props));
  const picker = nodes.find((node) => node.props['aria-label'] === 'UI Font Family');
  assert.equal(picker.props.dropdownPlacement, 'bottom', 'The UI font menu should open below its trigger');
  assert.deepEqual(picker.props.options.map((font) => font.label),
    ['Missing Saved Family', 'IBM Plex Sans', 'Inter Variable', 'Roboto Variable', 'Real Installed UI', 'Fira Code', 'JetBrains Mono']);
  assert.equal(picker.props.options[0].disabled, true);
  assert.equal(picker.props.options[0].badge, 'Unavailable');
  assert.equal(picker.props.options.at(-1).badge, 'Installed');
  assert.equal(picker.props.options[1].badge, 'Bundled');
  const preview = nodes.find((node) => node.type === 'div' && node.props.style?.fontFamily === props.value);
  assert.ok(preview, 'The preview must keep the selected font family');
  assert.match(preview.props.className, /\btext-text\b/);
  const heading = nodes.find((node) => node.type === 'h3');
  assert.match(heading.props.className, /\btext-text\b/, 'Preview heading needs an explicit theme foreground');
  assert.ok(heading.props.className.includes('text-[length:1rem]'));
  assert.ok(!heading.props.className.split(/\s+/).includes('text-base'),
    'text-base also resolves to the base background color in the app palette');
  assert.deepEqual(changes, [], 'Loading fonts must not change the user preference');
  nodes.find((node) => node.type === 'button' && node.props.children.includes('Refresh system fonts')).props.onClick();
  assert.deepEqual(refreshes, [true]);
  picker.props.onChange('Real Installed UI'); assert.deepEqual(changes, ['Real Installed UI']);
  state.error = 'Could not load system fonts: Native failure';
  nodes = componentNodes(await runner.render(PreferencesUiFontTab, props));
  assert.ok(nodes.some((node) => node.props.role === 'alert' && node.props.children.includes(state.error)));
});

test('JSONC font completion uses the discovered catalog and inserts a quoted real family', async () => {
  const service = catalog(async () => ['Only Installed Here']);
  const { getPreferencesJsonCompletions } = loadWithMocks(url('utils/preferencesJsonCompletions.ts'), {
    '../services/systemFontCatalog': service,
  });
  const source = '{"appearance":{"uiFont":{"fontFamily":"';
  let completion = getPreferencesJsonCompletions(source, source.length, true);
  assert.deepEqual(completion.items.map((item) => item.label), ['IBM Plex Sans', 'Inter Variable', 'Roboto Variable', 'Fira Code']);
  await service.loadSystemFontFamilies();
  completion = getPreferencesJsonCompletions(source, source.length, true);
  assert.equal(completion.items.find((item) => item.label === 'Only Installed Here').insertText, '"Only Installed Here"');
  assert.ok(!completion.items.some((item) => item.label === 'Segoe UI'));
});
