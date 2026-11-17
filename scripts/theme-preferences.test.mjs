import assert from 'node:assert/strict';
import test from 'node:test';
import { markdownPreferencesHarness } from './helpers/markdownPreferencesHarness.mjs';

const settle = () => new Promise(resolve => setImmediate(resolve));

function themeSettings() {
  return { schemaVersion: 1, appearance: {
    themeMode: 'system', darkThemeId: 'catppuccin-mocha', lightThemeId: 'catppuccin-latte', density: 'standard',
  }, ai: {} };
}

test('selected built-in palette participates in Preferences Apply and persists by color scheme', async (t) => {
  const settings = themeSettings();
  const fixture = markdownPreferencesHarness({ languageSettings: settings });
  t.after(fixture.cleanup);
  fixture.render();
  await settle();
  let state = fixture.render();
  state.appearance.setDraftDarkThemeId('dracula');
  state = fixture.render();
  assert.equal(state.transaction.totalUnsaved, 1);
  assert.equal(fixture.themeState.darkThemeId, 'catppuccin-mocha');
  assert.deepEqual(fixture.patches, []);

  assert.equal(await state.transaction.handleApply(), true, state.transaction.applyError);
  state = fixture.render();
  assert.deepEqual(fixture.patches[0].appearance, { darkThemeId: 'dracula' });
  assert.equal(settings.appearance.darkThemeId, 'dracula');
  assert.equal(fixture.themeState.darkThemeId, 'dracula');
  assert.equal(state.transaction.totalUnsaved, 0);
});

test('an unrelated Apply retains a newer palette selected in another window', async (t) => {
  const settings = themeSettings();
  const fixture = markdownPreferencesHarness({ languageSettings: settings });
  t.after(fixture.cleanup);
  fixture.render();
  await settle();
  let state = fixture.render();
  state.appearance.setDraftUiFontFamily('Inter');
  fixture.themeState.darkThemeId = 'monokai';
  settings.appearance.darkThemeId = 'monokai';
  state = fixture.render();

  assert.equal(await state.transaction.handleApply(), true, state.transaction.applyError);
  state = fixture.render();
  assert.equal(fixture.patches[0].appearance.darkThemeId, undefined);
  assert.equal(fixture.themeState.darkThemeId, 'monokai');
  assert.equal(state.appearance.draftDarkThemeId, 'monokai');
});
