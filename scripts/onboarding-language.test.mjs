import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';

const languageHook = new URL('../frontend/features/i18n/hooks/useAppLanguagePreference.ts', import.meta.url);

test('native language choice persists once and waits for the Rust broadcast before changing UI', async (t) => {
  const runner = hookHarness(), patches = [], applied = [];
  const previousWindow = globalThis.window;
  globalThis.window = {};
  t.after(() => { runner.cleanup(); globalThis.window = previousWindow; });
  const i18n = { resolvedLanguage: 'en', language: 'en' };
  let release;
  const { useAppLanguagePreference } = loadWithMocks(languageHook, {
    react: runner.react,
    'react-i18next': { useTranslation: () => ({ t: (key) => key, i18n }) },
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ platform: { capabilities: { backend: true } } }) },
    '../../preferences/services/preferencesJsonService': { preferencesJsonService: { patch: async (patch) => {
      patches.push(patch);
      await new Promise((resolve) => { release = resolve; });
      return { settings: { appearance: { language: 'vi' }, ai: { agentOutputLanguage: 'ja' } } };
    } } },
    '../services/applyAppLanguage': { applyAppLanguage: async (value) => applied.push(value) },
    '../utils/applyDocumentDirection': { applyDocumentDirection: (value) => applied.push(value) },
  });
  let state = runner.render(useAppLanguagePreference);
  await state.changeLanguage('en');
  await state.changeLanguage('invalid');
  assert.equal(patches.length, 0);
  const pending = state.changeLanguage('vi');
  await state.changeLanguage('ja');
  state = runner.render(useAppLanguagePreference);
  assert.equal(state.saving, true);
  assert.equal(state.language, 'en', 'No optimistic locale update');
  assert.deepEqual(patches, [{ appearance: { language: 'vi' } }]);
  release(); await pending;
  state = runner.render(useAppLanguagePreference);
  assert.equal(state.saving, false);
  assert.equal(state.language, 'en', 'A response alone does not replace the broadcast');
  assert.deepEqual(applied, []);
  assert.equal(window.__STAGE0_PREFERENCES__.ai.agentOutputLanguage, 'ja', 'Agent override remains intact');
  i18n.resolvedLanguage = 'vi';
  assert.equal(runner.render(useAppLanguagePreference).language, 'vi');
});

test('failed locale saves retain the committed language; the browser fallback applies only after success', async (t) => {
  const runner = hookHarness(), calls = [];
  const previousWindow = globalThis.window;
  globalThis.window = {};
  t.after(() => { runner.cleanup(); globalThis.window = previousWindow; });
  let fail = true;
  const { useAppLanguagePreference } = loadWithMocks(languageHook, {
    react: runner.react,
    'react-i18next': { useTranslation: () => ({ t: (key) => key, i18n: { resolvedLanguage: 'en' } }) },
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ platform: { capabilities: { backend: false } } }) },
    '../../preferences/services/preferencesJsonService': { preferencesJsonService: { patch: async () => {
      calls.push('persist');
      if (fail) throw Error('Disk unavailable');
      return { settings: { appearance: { language: 'ar' } } };
    } } },
    '../services/applyAppLanguage': { applyAppLanguage: async (value) => calls.push(`apply:${value}`) },
    '../utils/applyDocumentDirection': { applyDocumentDirection: (value) => calls.push(`direction:${value}`) },
  });
  let state = runner.render(useAppLanguagePreference);
  await state.changeLanguage('ar');
  state = runner.render(useAppLanguagePreference);
  assert.equal(state.language, 'en');
  assert.equal(state.error, 'Disk unavailable');
  assert.equal(state.saving, false);
  assert.deepEqual(calls, ['persist']);
  fail = false;
  await state.changeLanguage('ar');
  state = runner.render(useAppLanguagePreference);
  assert.equal(state.error, null);
  assert.deepEqual(calls, ['persist', 'persist', 'direction:ar', 'apply:ar']);
});

test('language wheel offers all 14 locales and commits keyboard and scroll selections explicitly', async (t) => {
  const runner = componentHarness(), choices = [];
  const previousWindow = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  t.after(() => { runner.cleanup(); globalThis.window = previousWindow; });
  const { OnboardingLanguagePicker } = loadWithMocks(new URL('../frontend/features/onboarding/components/OnboardingLanguagePicker.tsx', import.meta.url), {
    react: runner.react,
    'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
    '../../../common/components/icons/ChevronDown': { ChevronDown: () => null },
    '../../../common/components/icons/Check': { Check: () => null },
    '../../../common/hooks/useOutsideDismiss': { useOutsideDismiss() {} },
  });
  const props = { value: 'en', disabled: false, onChange: (value) => choices.push(value) };
  const render = async () => componentNodes(await runner.render(OnboardingLanguagePicker, props));
  let nodes = await render();
  nodes.find((node) => node.props['aria-haspopup'] === 'listbox').props.onClick();
  nodes = await render();
  assert.equal(nodes.filter((node) => node.props.role === 'option').length, 14);
  assert.equal(nodes.some((node) => node.type === 'select'), false);
  assert.equal(nodes.filter((node) => node.props.role === 'option' && node.props['aria-selected']).length, 1);
  let list = nodes.find((node) => node.props.role === 'listbox');
  list.props.onKeyDown({ key: 'ArrowDown', preventDefault() {} });
  nodes = await render();
  list = nodes.find((node) => node.props.role === 'listbox');
  list.props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(choices, ['vi']);
  nodes = await render();
  assert.equal(nodes.some((node) => node.props.role === 'listbox'), false);
  nodes.find((node) => node.props['aria-haspopup'] === 'listbox').props.onClick();
  nodes = await render();
  list = nodes.find((node) => node.props.role === 'listbox');
  list.props.ref.current = { scrollTop: 13 * 44 };
  list.props.onScroll();
  await new Promise((resolve) => setTimeout(resolve, 140));
  assert.deepEqual(choices, ['vi'], 'Scrolling alone must not spam global preference writes');
  nodes = await render();
  list = nodes.find((node) => node.props.role === 'listbox');
  assert.ok(list.props['aria-activedescendant'].endsWith('-ar'));
  list.props.onKeyDown({ key: 'Enter', preventDefault() {} });
  assert.deepEqual(choices, ['vi', 'ar']);
});
