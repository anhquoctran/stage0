import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';
import { markdownPreferencesHarness } from './helpers/markdownPreferencesHarness.mjs';

const density = loadWithMocks(new URL('../frontend/features/preferences/utils/uiDensity.ts', import.meta.url), {});
const settle = () => new Promise(resolve => setImmediate(resolve));
async function fixture(t, initial = 'standard') {
  const previous = globalThis.document;
  const attributes = new Map([['data-ui-density', initial]]);
  globalThis.document = { documentElement: { setAttribute: (key, value) => attributes.set(key, value),
    style: { setProperty() {} } } };
  const document = { schemaVersion: 1, appearance: { density: initial, futureOption: 7 }, ai: {} };
  const f = markdownPreferencesHarness({ languageSettings: document });
  t.after(() => { f.cleanup(); globalThis.document = previous; });
  await settle();
  return { ...f, document, current: () => attributes.get('data-ui-density') };
}

test('density defaults to Standard for old preferences and invalid bootstrap values', () => {
  for (const value of [undefined, null, '', 'dense', 42, {}, 'Standard']) {
    assert.equal(density.normalizeUiDensity(value), 'standard');
    assert.equal(density.readUiDensity({ appearance: { density: value } }), 'standard');
  }
  assert.equal(density.readUiDensity(), 'standard');
  for (const value of ['standard', 'compact', 'touch']) assert.equal(density.normalizeUiDensity(value), value);
  assert.deepEqual(['compact', 'standard', 'touch'].map(density.densityGraphRowHeight), [28, 36, 48]);
});

test('density-only draft enables Apply; Cancel discards it without affecting any window', async t => {
  const f = await fixture(t);
  let state = f.render();
  assert.equal(state.appearance.draftUiDensity, 'standard');
  state.appearance.setDraftUiDensity('touch'); state = f.render();
  assert.equal(state.transaction.totalUnsaved, 1);
  assert.equal(state.transaction.canCommitPreferences, true);
  assert.equal(f.current(), 'standard');
  assert.equal(f.patches.length, 0);
  state.transaction.handleCancel(); f.render();
  f.preferences.isPreferencesOpen = true; f.render(); await settle(); state = f.render();
  assert.equal(state.appearance.draftUiDensity, 'standard');
  assert.equal(state.transaction.totalUnsaved, 0);
  assert.equal(f.patches.length, 0);
});

test('Apply publishes density only after the atomic commit succeeds and preserves unrelated preferences', async t => {
  const f = await fixture(t);
  let state = f.render(), release;
  state.appearance.setDraftUiDensity('compact'); state = f.render();
  f.pause(new Promise(resolve => { release = resolve; }));
  const pending = state.transaction.handleApply();
  assert.equal(f.current(), 'standard');
  assert.equal(f.preferences.uiDensity, 'standard');
  assert.deepEqual(f.patches, [{ appearance: { density: 'compact' } }]);
  release(); assert.equal(await pending, true); state = f.render();
  assert.equal(f.current(), 'compact'); assert.equal(f.preferences.uiDensity, 'compact');
  assert.equal(f.document.appearance.futureOption, 7);
  assert.equal(state.transaction.totalUnsaved, 0);
  assert.equal(state.transaction.showRestartPrompt, false);
  state.transaction.handleCancel(); assert.equal(f.current(), 'compact');
});

test('failed OK retains density draft, keeps the dialog open and never publishes it', async t => {
  const f = await fixture(t);
  let state = f.render(); state.appearance.setDraftUiDensity('touch'); state = f.render();
  f.fail(); await state.transaction.handleOk(); state = f.render();
  assert.equal(f.current(), 'standard'); assert.equal(f.preferences.uiDensity, 'standard');
  assert.equal(f.document.appearance.density, 'standard');
  assert.equal(state.appearance.draftUiDensity, 'touch');
  assert.equal(f.preferences.isPreferencesOpen, true);
  assert.match(state.transaction.applyError, /Disk unavailable/);
});

test('Reset stages Standard and OK persists it without restart', async t => {
  const f = await fixture(t, 'touch');
  let state = f.render(); assert.equal(state.appearance.draftUiDensity, 'touch');
  state.transaction.handleResetDefaults(); state = f.render();
  assert.equal(state.appearance.draftUiDensity, 'standard'); assert.equal(f.current(), 'touch');
  await state.transaction.handleOk(); state = f.render();
  assert.equal(f.current(), 'standard'); assert.equal(f.document.appearance.density, 'standard');
  assert.equal(f.preferences.isPreferencesOpen, false); assert.equal(state.transaction.showRestartPrompt, false);
});

for (const source of ['store', 'file']) test(`concurrent ${source} density changes block a conflicting Apply`, async t => {
  const f = await fixture(t);
  let state = f.render(); state.appearance.setDraftUiDensity('compact'); state = f.render();
  if (source === 'store') f.preferences.uiDensity = 'touch';
  else f.document.appearance.density = 'touch';
  assert.equal(await state.transaction.handleApply(), false); state = f.render();
  assert.match(state.transaction.applyError, /preferences.density.conflict/);
  assert.equal(f.patches.length, 0); assert.equal(f.current(), 'standard');
  assert.equal(state.appearance.draftUiDensity, 'compact');
});

test('unmodified density does not overwrite a change received from another window', async t => {
  const f = await fixture(t);
  let state = f.render();
  f.preferences.uiDensity = 'touch'; f.document.appearance.density = 'touch';
  state.appearance.setDraftUiFontFamily('Inter'); state = f.render();
  assert.equal(await state.transaction.handleApply(), true);
  assert.deepEqual(f.patches, [{ appearance: { uiFont: { fontFamily: 'Inter' } } }]);
  assert.equal(f.preferences.uiDensity, 'touch'); assert.equal(f.current(), 'touch');
  state = f.render();
  assert.equal(state.appearance.draftUiDensity, 'touch');
  assert.equal(state.transaction.totalUnsaved, 0);
  state.appearance.setDraftUiFontFamily('Arial'); state = f.render();
  assert.equal(await state.transaction.handleApply(), true);
  assert.equal(f.document.appearance.density, 'touch');
  assert.equal(f.patches[1].appearance.density, undefined);
});
