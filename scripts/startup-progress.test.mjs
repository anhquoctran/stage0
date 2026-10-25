import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { loadWithMocks, componentHarness } from './helpers/componentHarness.mjs';

const phases = ['runtime', 'preferences', 'interface', 'window', 'repositories', 'workspace'];
const browserServices = { platform: { capabilities: { windows: false } } };
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function fixture({ reducedMotion = false } = {}) {
  const elements = new Map(), domEvents = new Map(), events = new Map(), timers = new Map();
  let now = 0, sequence = 0, reloads = 0;
  function element(id) {
    const classes = new Set(), attributes = {}, handlers = new Map();
    const value = { style: { setProperty() {} }, textContent: '', hidden: true, attributes, classes, handlers,
      setAttribute: (name, value) => { attributes[name] = value; },
      classList: { add: (...names) => names.forEach(name => classes.add(name)), remove: (...names) => names.forEach(name => classes.delete(name)) },
      addEventListener: (event, handler) => handlers.set(event, handler),
      remove: () => elements.delete(id),
    };
    elements.set(id, value);
    return value;
  }
  for (const id of ['startup-splash', 'startup-progress', 'startup-progress-fill', 'splash-status', 'splash-percentage', 'splash-detail', 'splash-reload']) element(id);
  const document = {
    documentElement: element('document-root'),
    getElementById: id => elements.get(id),
    addEventListener: (name, handler) => { domEvents.set(name, [...(domEvents.get(name) ?? []), handler]); },
  };
  const window = {
    localStorage: { getItem: () => null },
    matchMedia: query => ({ matches: query.includes('reduced-motion') && reducedMotion }),
    addEventListener: (name, handler) => events.set(name, handler),
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    location: { reload: () => { reloads++; } },
  };
  vm.runInNewContext(fs.readFileSync('public/startup.js', 'utf8'), { window, document, console });
  (domEvents.get('DOMContentLoaded') ?? []).forEach(handler => handler());
  function advance(milliseconds) {
    const end = now + milliseconds;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      timers.delete(next[0]);
      now = next[1].at;
      next[1].callback();
    }
    now = end;
  }
  return { api: window.__STAGE0_STARTUP__, window, document, elements, events, timers, advance, get reloads() { return reloads; } };
}
function completeWork(f) { for (const phase of phases) { f.api.begin(phase); f.api.complete(phase); } }

test('splash begins at zero and advances only with completed startup work, not elapsed time', () => {
  const f = fixture();
  assert.equal(f.api.snapshot.percent, 0);
  assert.equal(f.elements.get('startup-progress').attributes['aria-valuenow'], '0');
  assert.equal(f.elements.get('splash-status').textContent, 'Starting Stage0');
  f.advance(60000);
  assert.equal(f.api.snapshot.percent, 0);
  f.api.complete('runtime');
  f.api.begin('preferences');
  assert.equal(f.api.snapshot.percent, 10);
  assert.equal(f.elements.get('splash-status').textContent, 'Loading preferences');
  assert.equal(f.elements.get('splash-detail').textContent, 'Step 2 of 7');
  assert.equal(f.elements.get('startup-progress-fill').style.width, '10%');
  assert.match(f.elements.get('startup-progress').attributes['aria-valuetext'], /Loading preferences.*10%/);
  f.api.finish();
  f.advance(60000);
  assert.equal(f.api.snapshot.status, 'loading');
  assert.ok(f.elements.has('startup-splash'), 'mounted/slow applications are never dismissed by a watchdog');
});

test('parallel catalog completions are bounded, monotonic and immune to repeated/stale phase reports', () => {
  const f = fixture();
  for (const phase of phases.slice(0, 4)) f.api.complete(phase);
  f.api.begin('repositories');
  f.api.update('repositories', 1 / 3);
  assert.equal(f.api.snapshot.percent, 65);
  f.api.update('repositories', 2 / 3);
  assert.equal(f.api.snapshot.percent, 70);
  f.api.update('repositories', 1 / 3);
  f.api.update('repositories', NaN);
  f.api.update('repositories', Infinity);
  assert.equal(f.api.snapshot.percent, 70);
  f.api.update('repositories', 2);
  f.api.complete('repositories');
  assert.equal(f.api.snapshot.percent, 75);
  f.api.begin('workspace');
  f.api.begin('preferences');
  f.api.update('unknown', 1);
  f.api.begin('unknown');
  assert.equal(f.api.snapshot.phase, 'workspace');
  assert.equal(f.api.snapshot.percent, 75);
});

test('100% is published only after required phases finish, with cancellable and reduced-motion dismissal', () => {
  const f = fixture();
  completeWork(f);
  assert.equal(f.api.snapshot.percent, 95);
  const cancel = f.api.finish();
  assert.equal(f.api.snapshot.percent, 100);
  assert.equal(f.elements.get('splash-status').textContent, 'Ready');
  f.advance(180);
  assert.equal(f.elements.get('startup-splash').classes.has('is-hidden'), true);
  cancel();
  assert.equal(f.elements.get('startup-splash').classes.has('is-hidden'), false);
  f.advance(5000);
  assert.ok(f.elements.has('startup-splash'));
  f.api.finish();
  f.advance(360);
  assert.equal(f.elements.has('startup-splash'), false);
  assert.equal(f.api.snapshot.status, 'dismissed');
  f.api.fail();
  assert.equal(f.api.snapshot.status, 'dismissed', 'later app errors cannot resurrect startup');
  const reduced = fixture({ reducedMotion: true });
  completeWork(reduced);
  reduced.api.finish();
  reduced.advance(0);
  assert.equal(reduced.api.snapshot.status, 'dismissed');
});

test('startup failures freeze actual progress, identify the failed phase and offer reload', () => {
  const f = fixture();
  f.api.complete('runtime');
  f.api.begin('preferences');
  f.events.get('unhandledrejection')({ type: 'unhandledrejection', reason: 'sensitive-fixture' });
  assert.equal(f.api.snapshot.status, 'error');
  assert.equal(f.api.snapshot.percent, 10);
  assert.match(f.elements.get('splash-detail').textContent, /Loading preferences did not finish/);
  assert.doesNotMatch(f.elements.get('splash-detail').textContent, /sensitive-fixture/);
  assert.equal(f.elements.get('splash-reload').hidden, false);
  f.elements.get('splash-reload').handlers.get('click')();
  assert.equal(f.reloads, 1);
  completeWork(f);
  f.api.finish();
  f.advance(60000);
  assert.equal(f.api.snapshot.percent, 10);
  assert.ok(f.elements.has('startup-splash'));
  const late = fixture();
  completeWork(late);
  late.api.finish();
  late.advance(180);
  late.api.fail();
  late.advance(1000);
  assert.equal(late.elements.get('startup-splash').classes.has('is-hidden'), false);
  assert.equal(late.api.snapshot.status, 'error');
});

test('optional image/font failures do not block startup; script failures do', () => {
  const f = fixture();
  const onError = f.events.get('error');
  onError({ type: 'error', target: { tagName: 'LINK' } });
  onError({ type: 'error', target: { tagName: 'IMG' } });
  assert.equal(f.api.snapshot.status, 'loading');
  onError({ type: 'error', target: { tagName: 'SCRIPT' } });
  assert.equal(f.api.snapshot.status, 'error');
});

test('native handoff holds the small splash until ready, resizes hidden and reveals before removing it', async () => {
  const f = fixture(), prepared = deferred(), revealed = deferred(), calls = [];
  completeWork(f);
  f.api.finish({ prepare: () => { calls.push('prepare'); return prepared.promise; },
    reveal: () => { calls.push('reveal'); return revealed.promise; } });
  assert.equal(f.api.snapshot.percent, 100);
  assert.deepEqual(calls, []);
  f.advance(180);
  await flush();
  assert.deepEqual(calls, ['prepare']);
  assert.ok(f.elements.has('startup-splash'));
  prepared.resolve();
  await flush();
  assert.equal(f.elements.get('startup-splash').style.visibility, 'hidden');
  assert.deepEqual(calls, ['prepare', 'reveal']);
  assert.equal(f.api.snapshot.status, 'ready');
  revealed.resolve();
  await flush();
  assert.equal(f.elements.has('startup-splash'), false);
  assert.equal(f.api.snapshot.status, 'dismissed');
});

test('failed native preparation retains a visible error/reload surface', async () => {
  const f = fixture();
  let revealed = 0;
  completeWork(f);
  f.api.finish({ prepare: async () => { throw new Error('native fixture'); }, reveal: async () => { revealed++; } });
  f.advance(180);
  await flush();
  assert.equal(f.api.snapshot.status, 'error');
  assert.equal(f.elements.get('startup-splash').style.visibility, '');
  assert.equal(f.elements.get('splash-reload').hidden, false);
  assert.equal(revealed, 1);
});

test('cancelled native handoff still reveals a prepared window without dismissing the current splash', async () => {
  const f = fixture(), prepared = deferred();
  let revealed = 0;
  completeWork(f);
  const cancel = f.api.finish({ prepare: () => prepared.promise, reveal: async () => { revealed++; } });
  f.advance(180);
  await flush();
  cancel();
  prepared.resolve();
  await flush();
  assert.equal(revealed, 1, 'an asynchronous completion cannot strand a hidden window');
  assert.ok(f.elements.has('startup-splash'));
  assert.notEqual(f.elements.get('startup-splash').style.visibility, 'hidden');
});

test('splash markup exposes determinate progress, responsive labels and reduced-motion styling', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /role="progressbar"[^>]+aria-valuemin="0"[^>]+aria-valuemax="100"[^>]+aria-valuenow="0"/);
  assert.match(html, /id="splash-status"[^>]+aria-live="polite"/);
  assert.match(html, /id="splash-reload"[^>]+hidden/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  assert.match(html, /transition: width 180ms ease-out/);
  assert.doesNotMatch(html, /startup-splash-progress|animation:[^;]*infinite/);
  const ids = fs.readFileSync('frontend/core/services/startup/StartupPhase.ts', 'utf8').match(/'[^']+'/g).map(id => id.slice(1, -1));
  assert.deepEqual(ids, [...phases, 'ready']);
});

test('ready hook waits for paint and cancels stale frames or StrictMode dismissal', async () => {
  const runner = componentHarness(), frames = new Map(), calls = [];
  let nextFrame = 0, cancelled = 0;
  const originalWindow = globalThis.window;
  globalThis.window = {
    __STAGE0_STARTUP__: {},
    requestAnimationFrame: callback => { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  };
  const { useStartupSplash } = loadWithMocks(new URL('../frontend/core/hooks/useStartupSplash.ts', import.meta.url), {
    react: runner.react,
    '../services/runtime/useApplicationServices': { useApplicationServices: () => browserServices },
    '../services/startup/startupProgress': { startupProgress: {
      complete: phase => calls.push(['complete', phase]), begin: phase => calls.push(['begin', phase]),
      finish: () => { calls.push(['finish']); return () => { cancelled++; }; },
    } },
  });
  const step = () => { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(); };
  try {
    await runner.render(() => useStartupSplash(false));
    assert.equal(frames.size, 0);
    await runner.render(() => useStartupSplash(true));
    assert.deepEqual(calls, []);
    step();
    assert.deepEqual(calls, []);
    await runner.render(() => useStartupSplash(false));
    assert.equal(frames.size, 0, 'readiness regressing cancels the stale paint');
    await runner.render(() => useStartupSplash(true));
    step(); step();
    assert.deepEqual(calls, [['complete', 'workspace'], ['begin', 'ready'], ['finish']]);
    runner.cleanup();
    assert.equal(cancelled, 1);
  } finally { globalThis.window = originalWindow; }
});

test('ready hook supplies the native prepare/reveal pair only when window capabilities exist', async t => {
  const runner = componentHarness(), frames = [], calls = [];
  const original = globalThis.window;
  globalThis.window = { __STAGE0_STARTUP__: {}, requestAnimationFrame: callback => (frames.push(callback), frames.length), cancelAnimationFrame() {} };
  t.after(() => { globalThis.window = original; });
  let handoff;
  const services = { platform: { capabilities: { windows: true } }, application: {
    windowPrepareMain: async () => { calls.push('prepare'); }, windowShow: async () => { calls.push('reveal'); },
  } };
  const { useStartupSplash } = loadWithMocks(new URL('../frontend/core/hooks/useStartupSplash.ts', import.meta.url), {
    react: runner.react,
    '../services/runtime/useApplicationServices': { useApplicationServices: () => services },
    '../services/startup/startupProgress': { startupProgress: {
      complete() {}, begin() {}, finish: value => { handoff = value; return () => {}; },
    } },
  });
  await runner.render(() => useStartupSplash(true));
  frames.shift()(); frames.shift()();
  assert.deepEqual(calls, [], 'native geometry is deferred until the final progress transition');
  await handoff.prepare(); await handoff.reveal();
  assert.deepEqual(calls, ['prepare', 'reveal']);
  runner.cleanup();
});

test('all native application windows begin compact and restore workspace bounds only through the handoff', () => {
  for (const path of ['backend/tauri.conf.json', 'backend/tauri.macos.conf.json']) {
    const window = JSON.parse(fs.readFileSync(path, 'utf8')).app.windows.find(window => window.label === 'main');
    assert.deepEqual([window.width, window.height, window.minWidth, window.minHeight], [600, 380, 600, 380]);
    assert.equal(window.decorations, false);
    assert.equal(window.resizable, false);
    assert.equal(window.maximizable, false);
    assert.equal(window.center, true);
  }
  const manager = fs.readFileSync('backend/src/core/window_manager.rs', 'utf8');
  assert.match(manager, /inner_size\(SPLASH_WIDTH, SPLASH_HEIGHT\)/);
  assert.match(manager, /resizable\(false\)/);
  assert.doesNotMatch(manager, /window\.maximize\(\)/, 'repository opening uses deferred maximize requests');
  const native = fs.readFileSync('backend/src/core/window_manager/startup_window.rs', 'utf8');
  assert.match(native, /SPLASH_WIDTH: f64 = 600\.0/);
  assert.match(native, /SPLASH_HEIGHT: f64 = 380\.0/);
  assert.ok(native.indexOf('window.hide()') < native.indexOf('let result = configure_main_window'));
  assert.match(native, /set_resizable\(true\)/);
  assert.match(native, /set_decorations\(true\)/);
  const service = fs.readFileSync('frontend/core/services/transport/createApplicationService.ts', 'utf8');
  assert.match(service, /windowPrepareMain:.*executeCommand\('window_prepare_main'\)/);
  assert.match(service, /windowShow:.*executeCommand\('window_show'\)/);
});

function mainFixture(t) {
  const previous = new Map(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.document = { getElementById: () => null };
  const runner = componentHarness(), registrations = [], calls = [], readiness = [], reports = [], initCalls = [];
  const initialize = deferred(), attach = deferred();
  const repo = { id: 'repo', local_path: '/fixture', name: 'Fixture' };
  const git = { currentRepo: null, isInitializing: false, isLoading: false,
    initApp: async (restore, report) => { initCalls.push({ restore, report }); await initialize.promise; },
    attachRepoToCurrentWindow: async value => { git.currentRepo = value; git.isLoading = true; await attach.promise; git.isLoading = false; },
    refreshDiff() {},
  };
  const mr = { currentRepoId: null, currentRepoPath: null, isLoadingSessions: false };
  const services = {
    platform: { capabilities: { backend: true, events: true, windows: false }, events: {
      subscribe: (name, receive) => { const pending = deferred(); registrations.push({ name, receive, ...pending }); return pending.promise; },
    } },
    application: { getWindowChrome: async () => ({ platform: 'linux', desktop: 'gnome', session: 'wayland', nativeFrame: true, controlsLeft: [], controlsRight: ['close'], doubleClickAction: 'maximize' }), getWindowStartupContext: async () => { calls.push('context'); return { restore_recent: false, repo }; },
      windowIsMaximized: async () => false, windowIsFullscreen: async () => false },
  };
  const { MainApp } = loadWithMocks(new URL('../frontend/core/MainApp.tsx', import.meta.url), {
    react: runner.react, clsx: { clsx: () => '' },
    './services/runtime/useApplicationServices': { useApplicationServices: () => services },
    './services/startup/startupProgress': { startupProgress: Object.fromEntries(['begin', 'complete', 'update', 'fail'].map(method => [method, (...args) => reports.push([method, ...args])])) },
    './hooks/useStartupSplash': { useStartupSplash: ready => readiness.push(ready) },
    './services/autoHideScrollbars': { installAutoHideScrollbars: () => () => {} },
    './components/layout/MainLayout': { MainLayout: () => null },
    '../features/git/store/useGitStore': { useGitStore: Object.assign(() => git, { getState: () => git }) },
    '../features/virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: selector => selector(mr) },
    '../features/notifications/store/useNotificationStore': { useNotificationStore: selector => selector({ unreadCount: 0 }) },
    '../features/notifications/services/notificationService': { notificationService: { init: async () => {}, destroy() {} } },
    '../features/notifications/services/notificationBadgeService': { syncUnreadBadge: async () => {} },
    '../features/onboarding/store/useOnboardingStore': { useOnboardingStore: selector => selector({ isOnboardingOpen: false, setOnboardingOpen() {} }) },
    '../features/onboarding/components/FirstLaunchWelcome': { FirstLaunchWelcome: () => null },
    '../features/review/services/assignedReviewService': { reviewAssignedSessionAfterGitChange: async () => {} },
  });
  t.after(() => {
    runner.cleanup();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  });
  return { ...runner, render: () => runner.render(MainApp), registrations, readiness, reports, initCalls, initialize, attach, repo, git, mr, calls };
}

test('main-screen readiness waits for repository attachment and matching Virtual MR data', async t => {
  const f = mainFixture(t);
  await f.render();
  assert.equal(f.registrations.length, 2);
  assert.equal(f.readiness.at(-1), false);
  f.registrations.forEach(registration => registration.resolve(() => {}));
  await flush();
  assert.equal(f.initCalls[0].restore, false);
  f.initCalls[0].report({ phase: 'catalog', completed: 1, total: 3 });
  assert.ok(f.reports.some(report => report[0] === 'update' && report[1] === 'repositories' && report[2] === 1 / 3));
  f.initialize.resolve();
  await f.render();
  assert.equal(f.git.isLoading, true);
  assert.equal(f.readiness.at(-1), false);
  f.attach.resolve();
  await f.render();
  assert.equal(f.readiness.at(-1), false, 'a prepared Git store is not yet a loaded MR workspace');
  Object.assign(f.mr, { currentRepoId: 'another-repo', currentRepoPath: '/another', isLoadingSessions: false });
  await f.render();
  assert.equal(f.readiness.at(-1), false);
  Object.assign(f.mr, { currentRepoId: f.repo.id, currentRepoPath: f.repo.local_path, isLoadingSessions: true });
  await f.render();
  assert.equal(f.readiness.at(-1), false);
  f.mr.isLoadingSessions = false;
  await f.render();
  assert.equal(f.readiness.at(-1), true);
  assert.ok(f.reports.some(report => report[0] === 'update' && report[1] === 'workspace' && report[2] === 0.5));
});

test('startup releases partial/late event registrations and ignores disposed initialization', async t => {
  t.mock.method(console, 'warn', () => {});
  const f = mainFixture(t);
  let stopped = 0;
  await f.render();
  f.registrations[0].resolve(() => { stopped++; });
  await flush();
  f.registrations[1].reject(new Error('second listener denied'));
  await flush();
  assert.equal(stopped, 1);
  assert.equal(f.initCalls[0].restore, true, 'window setup failure retains repository initialization fallback');
  f.cleanup();
  f.initialize.resolve();
  await flush();
  assert.equal(f.readiness.includes(true), false);
  assert.equal(f.reports.some(report => report[0] === 'complete' && report[1] === 'workspace'), false);
});

test('subscriptions resolving after unmount are disposed without starting window or repository work', async t => {
  const f = mainFixture(t);
  let stopped = 0;
  await f.render();
  f.cleanup();
  f.registrations.forEach(registration => registration.resolve(() => { stopped++; }));
  await flush();
  assert.equal(stopped, 2);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.initCalls, []);
});

function repositoryFixture() {
  const recent = deferred(), sandbox = deferred(), active = deferred(), calls = [], reports = [];
  const state = { currentRepo: null,
    fetchAvailableSandboxes: () => { calls.push('sandboxes'); return sandbox.promise; },
    fetchActiveSandbox: () => { calls.push('active'); return active.promise; },
  };
  const { createGitRepoSlice } = loadWithMocks(new URL('../frontend/features/git/store/slices/createGitRepoSlice.ts', import.meta.url), {
    '../../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({
      gitRepositories: { getRecentRepos: () => { calls.push('recent'); return recent.promise; } },
      application: { windowResetSize: async () => { calls.push('reset-window'); } },
    }) },
    '../../services/gitStoreEffects': { gitDiffRequests: { version: 0 }, syncRecentRepositoriesMenu: async () => {}, getErrorMessage: String },
    './createGitCloneActions': { createGitCloneActions: () => ({}) },
  });
  const slice = createGitRepoSlice(update => Object.assign(state, update), () => state, {});
  return { recent, sandbox, active, calls, reports, state, slice };
}

test('repository initialization reports actual parallel completions and waits for failures to settle', async t => {
  t.mock.method(console, 'warn', () => {});
  const f = repositoryFixture();
  let finished = false;
  const work = f.slice.initApp(false, progress => f.reports.push(progress)).then(() => { finished = true; });
  assert.deepEqual(f.calls, ['recent', 'sandboxes', 'active']);
  assert.equal(f.reports[0].completed, 0);
  f.recent.reject(new Error('recent unavailable'));
  await flush();
  assert.equal(f.reports.at(-1).completed, 1);
  assert.equal(finished, false);
  assert.equal(f.state.isInitializing, true);
  f.sandbox.resolve();
  await flush();
  assert.equal(f.reports.at(-1).completed, 2);
  assert.equal(finished, false);
  f.active.resolve();
  await work;
  assert.equal(f.reports.at(-1).completed, 3);
  assert.equal(finished, true);
  assert.equal(f.state.isInitializing, false);
});

test('progress observers cannot interrupt repository initialization or alter default window handling', async () => {
  const f = repositoryFixture();
  const work = f.slice.initApp(false, () => { throw new Error('UI observer failure'); });
  f.recent.resolve([]); f.sandbox.resolve(); f.active.resolve();
  await work;
  assert.equal(f.state.isInitializing, false);
  assert.deepEqual(f.state.recentRepos, []);
  assert.deepEqual(f.calls, ['recent', 'sandboxes', 'active', 'reset-window']);
});
