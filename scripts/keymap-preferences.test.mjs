import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';

const url = (path) => new URL(`../frontend/${path}`, import.meta.url);
const original = { preset: 'stage0', overrides: [] };
const custom = { preset: 'vscode', overrides: [{ command: 'pull', keys: ['CmdOrCtrl+F8'] }] };

function applyFixture(draft = custom, current = original) {
  const calls = [], prefs = { keymap: current };
  let failure = false, paused, saved;
  const store = { getState: () => prefs, setState: (value) => { Object.assign(prefs, value); calls.push('publish'); } };
  const { createPreferencesApplyAction } = loadWithMocks(url('features/preferences/services/createPreferencesApplyAction.ts'), {
    '../../../core/store/useThemeStore': { applyThemeToDocument() {}, persistThemeMode() {}, resolveTheme: () => 'dark', useThemeStore: { setState() {} } },
    '../../ai/services/commitAiPreferences': { commitAiPreferences: async (_, __, patch) => {
      calls.push(['patch', structuredClone(patch)]); if (paused) await paused;
      if (failure) throw Error('Save failed'); return {};
    } },
    '../../git/store/useGitBinaryStore': { useGitBinaryStore: { setState() {} } },
    '../../git/store/useGitStore': { useGitStore: { setState() {}, getState: () => ({ refreshDiff() {} }) } },
    '../store/usePreferencesStore': { usePreferencesStore: store, applyViewerFontToDocument() {} },
    '../utils/applyMarkdownFontToDocument': { applyMarkdownFontToDocument() {} },
  });
  const baseline = { keymap: original, themeMode: 'system', fontFamily: 'Fira Code', fontSize: 13,
    isBold: false, isItalic: false, isUnderline: false, lineSpacing: 1.5, enableLigatures: true,
    showInlineBlame: true, sandboxType: 'in_memory', gitBinaryId: 'system', gitBinaryPath: 'git',
    markdownFontFamily: 'system', markdownCodeFontFamily: 'Fira Code', markdownFontSize: 13, markdownHeadingWeight: 600 };
  const options = { ...Object.fromEntries(Object.entries(baseline).map(([key, value]) => [`draft${key[0].toUpperCase()}${key.slice(1)}`, value])),
    draftKeymap: draft, setDraftKeymap: (value) => { calls.push(['draft', value]); },
    applyingRef: { current: false }, setIsApplying() {}, setApplyError: (value) => { if (value) calls.push(['error', value]); },
    savedBaseline: baseline, aiDraftStore: { getState: () => ({ replace() {} }) }, aiBaseline: {},
    setAiBaseline() {}, showToast() {}, setSavedBaseline: (value) => { saved = value; }, setIsApplied() {}, setShowRestartPrompt() {},
  };
  return { calls, prefs, options, apply: () => createPreferencesApplyAction(options)(),
    fail: () => { failure = true; }, pause: (promise) => { paused = promise; }, baseline: () => saved };
}

test('keymap joins the existing Preferences commit and activates only after success', async () => {
  const fixture = applyFixture();
  let release;
  fixture.pause(new Promise((resolve) => { release = resolve; }));
  const pending = fixture.apply();
  assert.deepEqual(fixture.calls[0], ['patch', { keymap: custom }]);
  assert.deepEqual(fixture.prefs.keymap, original);
  release();
  assert.equal(await pending, true);
  assert.deepEqual(fixture.prefs.keymap, custom);
  assert.deepEqual(fixture.baseline().keymap, custom);
  assert.deepEqual(fixture.calls.at(-1), ['draft', custom]);
});

test('failed saves and conflicting bindings retain the current runtime keymap and draft', async () => {
  const fixture = applyFixture(); fixture.fail();
  assert.equal(await fixture.apply(), false);
  assert.deepEqual(fixture.prefs.keymap, original);
  assert.ok(!fixture.calls.includes('publish'));
  assert.deepEqual(fixture.options.draftKeymap, custom);
  const invalid = applyFixture({ preset: 'stage0', overrides: [{ command: 'pull', keys: ['CmdOrCtrl+C'] }] });
  assert.equal(await invalid.apply(), false);
  assert.ok(!invalid.calls.some((call) => call[0] === 'patch'));
});

test('concurrent external keymap changes are preserved or reported instead of overwritten', async () => {
  const latest = { preset: 'github-desktop', overrides: [] };
  const conflict = applyFixture(custom, latest);
  assert.equal(await conflict.apply(), false);
  assert.ok(conflict.calls.some((call) => call[0] === 'error' && /another window/.test(call[1])));
  assert.deepEqual(conflict.prefs.keymap, latest);
  const unrelated = applyFixture(original, latest);
  assert.equal(await unrelated.apply(), true);
  assert.deepEqual(unrelated.calls[0], ['patch', {}]);
  assert.deepEqual(unrelated.prefs.keymap, latest);
  assert.deepEqual(unrelated.baseline().keymap, latest);
});

test('closing and reopening the draft session discards unapplied keymaps and reseeds committed values', async () => {
  const runner = hookHarness();
  const { usePreferencesDraftSession } = loadWithMocks(url('features/preferences/hooks/usePreferencesDraftSession.ts'), {
    react: runner.react, '../../ai/services/commitAiPreferences': { captureAiPreferences: () => ({ aiConfig: {} }) },
  });
  const props = { storedKeymap: original, isPreferencesOpen: true, storedAiConfig: {},
    aiDraftStore: { getState: () => ({ replace() {} }) }, setAiBaseline() {}, setApplyError() {},
    fetchActiveBinary: async () => ({ id: 'system', path: 'git' }), setSearchQuery() {}, setActiveTab() {}, setExpandedGroups() {} };
  let session = runner.render(usePreferencesDraftSession, props);
  session = runner.render(usePreferencesDraftSession, props);
  session.setDraftKeymap(custom);
  session = runner.render(usePreferencesDraftSession, props);
  assert.deepEqual(session.draftKeymap, custom);
  assert.deepEqual(session.savedBaseline.keymap, original);
  runner.render(usePreferencesDraftSession, { ...props, isPreferencesOpen: false });
  runner.render(usePreferencesDraftSession, props);
  session = runner.render(usePreferencesDraftSession, props);
  assert.deepEqual(session.draftKeymap, original);
  await new Promise((resolve) => setImmediate(resolve)); runner.cleanup();
});

test('binding editor records a portable chord, applies only to the draft and reports conflicts', async (t) => {
  const runner = componentHarness(); const changes = [];
  const previousDocument = globalThis.document;
  globalThis.document = { getElementById: () => ({ focus() {} }) };
  t.after(() => { globalThis.document = previousDocument; runner.cleanup(); });
  const { KeymapBindingRow } = loadWithMocks(url('features/preferences/components/keymaps/KeymapBindingRow.tsx'), { react: runner.react });
  const props = { command: { id: 'fetch', label: 'Fetch', scope: 'workspace', keys: ['CmdOrCtrl+Shift+F'], editable: true }, settings: original,
    onChange: (value) => { changes.push(value); props.settings = value; }, mac: true };
  const render = () => runner.render(KeymapBindingRow, props);
  let tree = await render();
  componentNodes(tree).find((node) => node.type === 'button' && node.props['aria-label'] === 'Edit Fetch').props.onClick();
  tree = await render();
  const button = (label) => componentNodes(tree).find((node) => node.type === 'button' && node.props.children.flat().includes(label));
  let input = componentNodes(tree).find((node) => node.type === 'input');
  input.props.onChange({ target: { value: 'CmdOrCtrl+C' } });
  tree = await render(); button('Done').props.onClick();
  tree = await render();
  assert.ok(componentNodes(tree).some((node) => node.props.role === 'alert'));
  assert.equal(changes.length, 1, 'invalid text stays in the Preferences draft for Apply validation, not the runtime');
  button('Record').props.onClick();
  tree = await render();
  for (const key of ['k', 'f']) {
    input = componentNodes(tree).find((node) => node.type === 'input');
    input.props.onKeyDown({ key, preventDefault() {}, stopPropagation() {}, nativeEvent: {
      key, code: `Key${key.toUpperCase()}`, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false,
    } });
    tree = await render();
  }
  button('Done').props.onClick();
  assert.deepEqual(changes.at(-1).overrides, [{ command: 'fetch', keys: ['CmdOrCtrl+K CmdOrCtrl+F'] }]);
});

test('registry dispatch keeps MR tab selection and branch comparison in sync', async () => {
  const calls = []; const sessions = [{ id: 'closed', baseBranch: 'old', compareBranch: 'old' }, { id: 'mr', baseBranch: 'main', compareBranch: 'feature' }];
  const git = { currentRepo: { id: 'repo' }, setBranchComparison: (...args) => calls.push(['compare', ...args]), showToast: (...args) => calls.push(['toast', ...args]) };
  const mr = { sessions, closedSessionTabIds: ['closed'], switchSession: (id) => calls.push(['switch', id]), isDraftActive: true, closeNewMrDraft: () => calls.push(['close-draft']) };
  const { executeKeymapCommand } = loadWithMocks(url('core/services/keymaps/actions.ts'), {
    '../../../features/git/store/useGitStore': { useGitStore: { getState: () => git } },
    '../../../features/virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: { getState: () => mr } },
    '../applicationMenuActions': { executeMenuAction: () => {} },
  });
  await executeKeymapCommand('tab_1', {}); await executeKeymapCommand('close_tab', {});
  assert.deepEqual(calls, [['switch', 'mr'], ['compare', 'main', 'feature'], ['close-draft']]);
  git.currentRepo = null; await executeKeymapCommand('tab_1', {});
  assert.equal(calls.length, 3);
});
