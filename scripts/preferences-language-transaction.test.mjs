import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { markdownPreferencesHarness } from './helpers/markdownPreferencesHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';

const settings = (ui = 'en', agent = 'follow-app') => ({
  schemaVersion: 1, appearance: { language: ui }, ai: { agentOutputLanguage: agent },
});
const settle = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(t, document = settings()) {
  const f = markdownPreferencesHarness({ languageSettings: document });
  t.after(f.cleanup);
  await settle();
  return { ...f, document };
}

test('language selectors edit only the dialog draft and offer the canonical 14 languages', async (t) => {
  const runner = componentHarness(); t.after(runner.cleanup);
  const { PreferencesLanguageTab } = loadWithMocks(new URL('../frontend/features/i18n/components/PreferencesLanguageTab.tsx', import.meta.url), {
    react: runner.react,
    'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
    '../../../common/components/CustomSelect': { CustomSelect: (props) => runner.react.createElement('button', { ...props, role: 'combobox' }) },
  });
  let value = { uiLanguage: 'en', agentOutputLanguage: 'follow-app' }, changes = 0;
  const render = async () => componentNodes(await runner.render(PreferencesLanguageTab, {
    value, onChange: (next) => { value = next(value); changes++; }, disabled: false, error: null,
  })).filter((node) => node.props.role === 'combobox');
  let [ui, agent] = await render();
  assert.equal(ui.props.options.length, 14);
  assert.equal(agent.props.options.length, 15);
  ui.props.onChange('vi'); agent.props.onChange('ja');
  [ui, agent] = await render();
  assert.equal(ui.props.value, 'vi'); assert.equal(agent.props.value, 'ja');
  ui.props.onChange('en-US'); agent.props.onChange('unsupported');
  assert.equal(changes, 2, 'Unsupported values never enter the draft');
});

test('language-only edits enable Apply; Cancel and reopening discard both without writing', async (t) => {
  const f = await fixture(t);
  let state = f.render();
  assert.equal(state.transaction.totalUnsaved, 0);
  state.language.onChange(() => ({ uiLanguage: 'vi', agentOutputLanguage: 'ja' }));
  state = f.render();
  assert.equal(state.transaction.totalUnsaved, 2);
  assert.equal(state.transaction.canCommitPreferences, true);
  assert.equal(f.document.appearance.language, 'en');
  assert.equal(f.document.ai.agentOutputLanguage, 'follow-app');
  assert.equal(f.patches.length, 0);
  state.transaction.handleCancel(); f.render();
  assert.equal(f.preferences.isPreferencesOpen, false);
  f.preferences.isPreferencesOpen = true; f.render(); await settle(); state = f.render();
  assert.deepEqual(state.language.value, { uiLanguage: 'en', agentOutputLanguage: 'follow-app' });
  assert.equal(state.transaction.totalUnsaved, 0);
  assert.equal(f.patches.length, 0);
});

test('Apply commits both language fields with the other settings once, then Cancel keeps that commit', async (t) => {
  const f = await fixture(t);
  let state = f.render(), release;
  state.language.onChange(() => ({ uiLanguage: 'vi', agentOutputLanguage: 'ru' }));
  state.appearance.setDraftUiFontFamily('Inter');
  state = f.render();
  assert.equal(state.transaction.totalUnsaved, 3);
  f.pause(new Promise((resolve) => { release = resolve; }));
  const pending = state.transaction.handleApply();
  state = f.render();
  assert.equal(state.transaction.isApplying, true);
  assert.equal(f.document.appearance.language, 'en', 'A pending write does not publish the draft');
  await state.transaction.handleApply(); state.transaction.handleCancel();
  assert.equal(f.preferences.isPreferencesOpen, true);
  assert.equal(f.patches.length, 1);
  assert.deepEqual(f.patches[0], {
    appearance: { language: 'vi', uiFont: { fontFamily: 'Inter' } },
    ai: { agentOutputLanguage: 'ru' },
  });
  release(); assert.equal(await pending, true);
  state = f.render();
  assert.equal(state.transaction.totalUnsaved, 0);
  assert.equal(state.transaction.showRestartPrompt, false);
  assert.equal(f.document.appearance.language, 'vi');
  assert.equal(f.document.ai.agentOutputLanguage, 'ru');
  state.language.onChange((previous) => ({ ...previous, agentOutputLanguage: 'fr' }));
  state = f.render(); state.transaction.handleCancel();
  assert.equal(f.document.ai.agentOutputLanguage, 'ru');
});

test('OK saves and closes; a failed OK retains both language drafts and the previous committed values', async (t) => {
  const f = await fixture(t);
  let state = f.render();
  state.language.onChange(() => ({ uiLanguage: 'ar', agentOutputLanguage: 'ja' }));
  state = f.render(); f.fail();
  await state.transaction.handleOk(); state = f.render();
  assert.equal(f.preferences.isPreferencesOpen, true);
  assert.deepEqual(state.language.value, { uiLanguage: 'ar', agentOutputLanguage: 'ja' });
  assert.equal(f.document.appearance.language, 'en');
  assert.equal(f.document.ai.agentOutputLanguage, 'follow-app');
  assert.equal(state.transaction.totalUnsaved, 2);
  assert.match(state.transaction.applyError, /Disk unavailable/);
});

test('OK commits language-only edits without requesting a restart', async (t) => {
  const f = await fixture(t);
  let state = f.render();
  state.language.onChange(() => ({ uiLanguage: 'de', agentOutputLanguage: 'follow-app' }));
  state = f.render(); await state.transaction.handleOk(); state = f.render();
  assert.equal(f.preferences.isPreferencesOpen, false);
  assert.equal(f.document.appearance.language, 'de');
  assert.equal(f.document.ai.agentOutputLanguage, 'follow-app');
  assert.equal(state.transaction.showRestartPrompt, false);
});

test('Reset to Defaults stages English and follow-app; Apply is required to save them', async (t) => {
  const f = await fixture(t, settings('vi', 'ja'));
  let state = f.render(); state.transaction.handleResetDefaults(); state = f.render();
  assert.deepEqual(state.language.value, { uiLanguage: 'en', agentOutputLanguage: 'follow-app' });
  assert.equal(f.document.appearance.language, 'vi'); assert.equal(f.document.ai.agentOutputLanguage, 'ja');
  assert.equal(f.patches.length, 0);
  state.transaction.handleCancel(); f.render();
  f.preferences.isPreferencesOpen = true; f.render(); await settle();
  state = f.render(); state.transaction.handleResetDefaults(); state = f.render();
  assert.equal(await state.transaction.handleApply(), true);
  assert.equal(f.document.appearance.language, 'en'); assert.equal(f.document.ai.agentOutputLanguage, 'follow-app');
});

test('an overlapping language change in another window blocks Apply without losing the draft', async (t) => {
  const f = await fixture(t);
  let state = f.render();
  state.language.onChange((previous) => ({ ...previous, uiLanguage: 'vi' }));
  f.document.appearance.language = 'fr';
  state = f.render();
  assert.equal(await state.transaction.handleApply(), false);
  state = f.render();
  assert.equal(f.patches.length, 0);
  assert.equal(state.language.value.uiLanguage, 'vi');
  assert.equal(f.document.appearance.language, 'fr');
  assert.match(state.transaction.applyError, /another window/);
});

test('Apply preserves an external agent override when only the UI language was edited', async (t) => {
  const f = await fixture(t);
  let state = f.render();
  state.language.onChange((previous) => ({ ...previous, uiLanguage: 'ar' }));
  f.document.ai.agentOutputLanguage = 'es';
  state = f.render(); assert.equal(await state.transaction.handleApply(), true); state = f.render();
  assert.deepEqual(f.patches[0], { appearance: { language: 'ar' } });
  assert.deepEqual(state.language.value, { uiLanguage: 'ar', agentOutputLanguage: 'es' });
  assert.equal(state.transaction.totalUnsaved, 0);
});

test('an unrelated Apply preserves and rebases newer saved languages from another window', async (t) => {
  const f = await fixture(t);
  let state = f.render(); state.appearance.setDraftUiFontFamily('Inter');
  f.document.appearance.language = 'de'; f.document.ai.agentOutputLanguage = 'ja';
  state = f.render(); assert.equal(await state.transaction.handleApply(), true); state = f.render();
  assert.deepEqual(f.patches[0], { appearance: { uiFont: { fontFamily: 'Inter' } } });
  assert.deepEqual(state.language.value, { uiLanguage: 'de', agentOutputLanguage: 'ja' });
  assert.equal(state.transaction.totalUnsaved, 0);
});

test('opening reads languages from Rust and a late read from a closed dialog cannot replace the new draft', async (t) => {
  const runner = hookHarness(), requests = [], applied = [];
  const previousWindow = globalThis.window;
  globalThis.window = { __STAGE0_PREFERENCES__: settings() };
  t.after(() => { runner.cleanup(); globalThis.window = previousWindow; });
  const { usePreferencesLanguageDraft } = loadWithMocks(new URL('../frontend/features/preferences/hooks/usePreferencesLanguageDraft.ts', import.meta.url), {
    react: runner.react,
    '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({
      platform: { capabilities: { backend: true, preferencesFile: true } },
      preferences: { loadPreferencesJson: () => new Promise((resolve) => requests.push(resolve)) },
    }) },
    '../../i18n/i18n': { default: { t: (key) => key } },
    '../../i18n/services/applyAppLanguage': { applyAppLanguage: async (code) => applied.push(code) },
    '../../i18n/utils/applyDocumentDirection': { applyDocumentDirection: (code) => applied.push(code) },
  });
  let draft = runner.render(usePreferencesLanguageDraft, true);
  assert.equal(draft.loading, true);
  runner.render(usePreferencesLanguageDraft, false);
  runner.render(usePreferencesLanguageDraft, true);
  requests[1]({ settings: settings('de', 'ja') }); await settle();
  draft = runner.render(usePreferencesLanguageDraft, true);
  assert.equal(draft.loading, false);
  assert.deepEqual(draft.value, { uiLanguage: 'de', agentOutputLanguage: 'ja' });
  draft.setValue((previous) => ({ ...previous, uiLanguage: 'ko' }));
  requests[0]({ settings: settings('vi', 'follow-app') }); await settle();
  draft = runner.render(usePreferencesLanguageDraft, true);
  assert.equal(draft.value.uiLanguage, 'ko');
  assert.equal(draft.baseline.uiLanguage, 'de');
  assert.equal(draft.changeCount, 1);
  assert.deepEqual(applied, [], 'Loading and editing do not change the UI locale or direction');
});
