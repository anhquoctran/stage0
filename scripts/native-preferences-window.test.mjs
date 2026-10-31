import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHarness } from './helpers/hookHarness.mjs';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const url = path => new URL(`../frontend/${path}`, import.meta.url);
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

test('Preferences custom title bar offers only Close and single-click dragging on each desktop', async t => {
  for (const platform of ['macos', 'windows', 'linux']) {
    const runner = componentHarness(); t.after(runner.cleanup);
    let moved = 0, closed = 0;
    const { PreferencesModalTopBar } = loadWithMocks(url('features/preferences/components/PreferencesModalTopBar.tsx'), {
      react: runner.react,
      'react-i18next': { useTranslation: () => ({ t: key => key }) },
      '@/common/components/icons/X': { X: () => null },
      '@/core/store/useWindowChromeStore': { useWindowChromeStore: selector => selector({ profile: { platform, nativeFrame: false } }) },
      '@/core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ application: { windowStartDragging: async () => { moved++; } } }) },
    });
    const tree = await runner.render(PreferencesModalTopBar, { standalone: true, onClose: () => { closed++; }, onOpenJsonEditor() {} });
    const buttons = componentNodes(tree).filter(node => node.type === 'button');
    assert.equal(buttons.length, 2, 'One editor action and one Close control; no minimize/maximize controls');
    const close = buttons.find(node => node.props['aria-label']?.startsWith('common.close'));
    assert.ok(close);
    close.props.onClick(); assert.equal(closed, 1);
    const pointer = (detail, interactive = false) => ({ button: 0, detail, target: { closest: () => interactive ? {} : null }, preventDefault() {} });
    tree.props.onMouseDown(pointer(1));
    tree.props.onMouseDown(pointer(2));
    tree.props.onMouseDown(pointer(1, true));
    assert.equal(moved, 1, 'Double-click and interactive controls cannot trigger a native frame action');
  }
});

test('every repo routes Preferences/deep links to Rust without opening a local draft; the utility and browser keep local editing', async t => {
  const previous = globalThis.window, previousStorage = globalThis.localStorage;
  globalThis.window = { __STAGE0_PREFERENCES__: {}, addEventListener() {}, removeEventListener() {} };
  globalThis.localStorage = { getItem: () => null };
  t.after(() => { globalThis.window = previous; globalThis.localStorage = previousStorage; });
  let label = 'win_repo_a', native = true, fail = false;
  const opened = [], errors = [];
  const services = { platform: { capabilities: { backend: true, windows: true }, windows: { current: () => ({ label }) } },
    application: { openPreferencesWindow: async input => { if (fail) throw Error('Window build denied'); opened.push({ label, ...input }); } } };
  const { usePreferencesStore } = loadWithMocks(url('features/preferences/store/usePreferencesStore.ts'), {
    '@/features/i18n/i18n': { default: { t: (_, values) => `Could not open Preferences: ${values.error}` } },
    '@/core/services/runtime/applicationRuntime': { getApplicationServices: () => ({ ...services, platform: { ...services.platform, capabilities: { backend: native, windows: native } } }) },
    '@/features/git/store/useGitStore': { useGitStore: { getState: () => ({ showToast: (...args) => errors.push(args) }) } },
  });
  usePreferencesStore.getState().openPreferences('ai-reviewers');
  assert.equal(usePreferencesStore.getState().isPreferencesOpen, false);
  label = 'win_repo_b';
  usePreferencesStore.getState().setInitialPreferencesTab('appearance-language');
  usePreferencesStore.getState().setIsPreferencesOpen(true);
  assert.equal(usePreferencesStore.getState().isPreferencesOpen, false);
  await tick();
  assert.deepEqual(opened, [{ label: 'win_repo_a', tab: 'ai-reviewers' }, { label: 'win_repo_b', tab: 'appearance-language' }]);
  fail = true;
  usePreferencesStore.getState().openPreferences(); await tick();
  assert.match(errors[0][0], /Window build denied/);
  assert.equal(usePreferencesStore.getState().isPreferencesOpen, false, 'Creation failure cannot create a second local editor');
  label = 'preferences';
  usePreferencesStore.getState().openPreferences('ai-providers');
  assert.equal(usePreferencesStore.getState().isPreferencesOpen, true);
  assert.equal(usePreferencesStore.getState().initialPreferencesTab, 'ai-providers');
  usePreferencesStore.getState().setIsPreferencesOpen(false);
  native = false; label = 'browser';
  usePreferencesStore.getState().openPreferences();
  assert.equal(usePreferencesStore.getState().isPreferencesOpen, true, 'Browser fallback retains its dialog');
  assert.equal(opened.length, 2);
});

function lifecycle(t) {
  const runner = hookHarness(); t.after(runner.cleanup);
  const pending = [], handlers = new Map(), stops = [], tabs = [];
  let ready = 0, closed = 0;
  const services = { platform: { capabilities: { backend: true, windows: true }, events: { subscribe: (name, handler) => {
    const registration = deferred(); pending.push({ name, registration }); handlers.set(name, handler);
    return registration.promise;
  } } }, application: { preferencesWindowReady: async () => { ready++; }, closePreferencesWindow: async () => { closed++; } } };
  const { usePreferencesNativeWindow } = loadWithMocks(url('features/preferences/hooks/usePreferencesNativeWindow.ts'), {
    react: runner.react,
    'react-i18next': { useTranslation: () => ({ t: (key, values) => `${key}: ${values.error}` }) },
    '@/core/services/runtime/useApplicationServices': { useApplicationServices: () => services },
    '@/features/preferences/store/usePreferencesStore': { usePreferencesStore: { getState: () => ({ setInitialPreferencesTab: value => tabs.push(value) }) } },
  });
  const connect = i => pending[i].registration.resolve(() => { stops.push(pending[i].name); handlers.delete(pending[i].name); });
  return { runner, render: (open, cancel) => runner.render(() => usePreferencesNativeWindow(true, open, cancel)),
    handlers, connect, tabs, stops, ready: () => ready, closed: () => closed };
}

test('native close follows Cancel, blocks during Apply, and refocusing/deep-link navigation preserves the open draft', async t => {
  const f = lifecycle(t); let open = true, applying = false, cancellations = 0;
  const cancel = () => { if (!applying) { open = false; cancellations++; } };
  f.render(open, cancel);
  f.connect(0); await tick();
  assert.equal(f.ready(), 0, 'Never show/ack before both listeners are installed');
  f.connect(1); await tick();
  assert.equal(f.ready(), 1);
  f.handlers.get('preferences-window-open')({ tab: 'ai-reviewers' });
  f.handlers.get('preferences-window-open')({ tab: null });
  assert.deepEqual(f.tabs, ['ai-reviewers']);
  assert.equal(open, true); assert.equal(cancellations, 0);
  applying = true;
  f.handlers.get('preferences-window-close-requested')();
  f.render(open, cancel);
  assert.equal(open, true); assert.equal(f.closed(), 0);
  applying = false;
  f.handlers.get('preferences-window-close-requested')();
  f.render(open, cancel); await tick();
  f.render(open, cancel);
  assert.equal(cancellations, 1); assert.equal(f.closed(), 1);
  assert.equal(f.stops.length, 2);
});

test('late native listener registrations are disposed without acknowledging a destroyed view', async t => {
  const f = lifecycle(t);
  f.render(true, () => {});
  f.runner.cleanup();
  f.connect(0); f.connect(1); await tick();
  assert.equal(f.stops.length, 2); assert.equal(f.ready(), 0); assert.equal(f.closed(), 0);
});

test('the preferences window boots independently of repo and notification surfaces', async t => {
  const runner = componentHarness(); t.after(runner.cleanup);
  let label = 'preferences';
  const MainApp = () => null, PreferencesWindow = () => null;
  const { App } = loadWithMocks(url('core/App.tsx'), {
    react: runner.react,
    './services/runtime/useApplicationServices': { useApplicationServices: () => ({ platform: { capabilities: { windows: true }, windows: { current: () => ({ label }) } } }) },
    './MainApp': { MainApp },
    '../features/preferences/components/PreferencesWindow': { PreferencesWindow },
  });
  assert.equal((await runner.render(App)).type, PreferencesWindow);
  label = 'win_repo_b'; assert.equal((await runner.render(App)).type, MainApp);
});

test('repo window modal composition omits the native Preferences editor', async t => {
  const runner = componentHarness(); t.after(runner.cleanup);
  let native = true;
  const PreferencesModal = () => null;
  const otherModals = Object.fromEntries([
    ['git', 'CloneRepoModal'], ['git', 'GitTaskDialog'], ['git', 'MergeFromModal'],
    ['git', 'PullFromModal'], ['git', 'RebaseFromModal'], ['git', 'RemoteUrlFromModal'],
    ['git', 'RepositoryOverviewModal'], ['git', 'RepositorySettingsModal'],
  ].map(([feature, name]) => [`@/features/${feature}/components/${name}`, { [name]: () => null }]));
  const { MainLayoutModals } = loadWithMocks(url('core/components/layout/MainLayoutModals.tsx'), {
    react: runner.react,
    '@/core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ platform: { capabilities: { backend: native, windows: native } } }) },
    '@/features/preferences/components/PreferencesModal': { PreferencesModal },
    ...otherModals,
  });
  const render = async () => componentNodes(await runner.render(MainLayoutModals, {}));
  assert.equal((await render()).some(node => node.type === PreferencesModal), false);
  native = false;
  assert.equal((await render()).some(node => node.type === PreferencesModal), true);
});
