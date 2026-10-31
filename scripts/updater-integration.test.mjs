import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const { create } = require('zustand');
const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('official GitHub updater requires signed versions without exposing raw plugin capabilities', () => {
  const config = JSON.parse(source('backend/tauri.conf.json'));
  assert.equal(config.bundle.createUpdaterArtifacts, true);
  assert.equal(config.plugins.updater.requireSignedVersion, true);
  assert.deepEqual(config.plugins.updater.endpoints, ['https://github.com/anhquoctran/stage0/releases/download/channel-stable/latest.json']);
  assert.equal(config.plugins.updater.allowDowngrades ?? false, false);
  assert.doesNotMatch(source('backend/capabilities/default.json'), /updater:/);
  assert.doesNotMatch(source('backend/tauri.conf.json'), /downloadcenter\.quoctran\.space/);
  assert.doesNotMatch(config.app.security.csp, /github\.com/);
  assert.match(source('frontend/features/preferences/utils/normalizePreferenceTab.ts'), /SETTINGS_TREE\.some[\s\S]*?: 'ai-overview'/);
});

test('mounting the main window initializes repositories and notifications without scheduling update work', async () => {
  const harness = componentHarness();
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const calls = []; const listeners = new Map();
  let initialized = 0; let notified = 0; let destroyed = 0; let refreshed = 0;
  const attached = [];
  globalThis.window = {
    addEventListener() {}, removeEventListener() {},
    setTimeout() { assert.fail('Unexpected startup timer'); },
    setInterval() { assert.fail('Unexpected background scheduler'); },
  };
  globalThis.document = { getElementById: () => null, addEventListener() {}, removeEventListener() {}, documentElement: { classList: { add() {} }, style: {} }, body: { classList: { add() {} }, style: {} } };
  const git = { isInitializing: false, currentRepo: { local_path: '/fixture' }, initApp: async () => { initialized++; }, attachRepoToCurrentWindow: async (repo) => attached.push(repo), refreshDiff: () => { refreshed++; } };
  const useGitStore = Object.assign(() => git, { getState: () => git });
  try {
    const { MainApp } = loadWithMocks(new URL('../frontend/core/MainApp.tsx', import.meta.url), {
      react: harness.react, clsx: { clsx: () => '' },
      '@tauri-apps/api/core': { isTauri: () => true, invoke: async (name) => {
        calls.push(name);
        if (name === 'get_window_startup_context') return { restore_recent: false, repo: { id: 'repo-a' } };
        assert.ok(['window_is_maximized', 'window_is_fullscreen'].includes(name));
        return false;
      } },
      '@tauri-apps/api/event': { listen: async (name, handler) => { listeners.set(name, handler); return () => listeners.delete(name); } },
      './components/layout/MainLayout': { MainLayout: () => null },
      './hooks/useDesktopWindowChrome': { useDesktopWindowChrome: () => true },
      './hooks/useWindowFrameClipping': { useWindowFrameClipping() {} },
      '../features/virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: (selector) => selector({ currentRepoId: 'repo-a', currentRepoPath: '/fixture', isLoadingSessions: false }) },
      '../features/notifications/services/notificationService': { notificationService: { init: async () => { notified++; }, destroy: () => { destroyed++; } } },
      '../features/notifications/services/notificationBadgeService': { syncUnreadBadge: async () => {} },
      '../features/notifications/store/useNotificationStore': { useNotificationStore: (selector) => selector({ unreadCount: 0 }) },
      '../features/git/store/useGitStore': { useGitStore },
      '../features/review/services/assignedReviewService': { reviewAssignedSessionAfterGitChange: async () => {} },
      '../features/onboarding/store/useOnboardingStore': { useOnboardingStore: (selector) => selector({ isOnboardingOpen: false, setOnboardingOpen() {} }) },
      '../features/onboarding/components/FirstLaunchWelcome': { FirstLaunchWelcome: () => null, shouldShowFirstLaunchWelcome: () => false },
      './utils/isPrimaryAppWindow': { isPrimaryAppWindow: () => true },
    });
    await harness.render(MainApp);
    assert.equal(initialized, 1); assert.equal(notified, 1);
    assert.deepEqual(attached, [{ id: 'repo-a' }]);
    assert.equal(calls.filter((name) => name === 'get_window_startup_context').length, 1);
    listeners.get('repo-fs-changed')({ payload: { repo_path: '/fixture' } });
    assert.equal(refreshed, 1);
    listeners.get('repo-open-request')({ payload: { id: 'repo-b' } });
    assert.equal(attached.at(-1).id, 'repo-b');
    harness.cleanup();
    assert.equal(destroyed, 1); assert.equal(listeners.size, 0);
  } finally { globalThis.window = originalWindow; globalThis.document = originalDocument; }
});

test('legacy notification settings cannot restore the removed category; saved history remains intact', () => {
  const originalWindow = globalThis.window; const originalStorage = globalThis.localStorage;
  const history = [{ id: 'old-update', title: 'Historical release', isRead: false, channel: 'softwareUpdates' }];
  const values = new Map([
    ['stage0_notification_settings', JSON.stringify({ channels: { softwareUpdates: true, aiReview: false, gitSync: false, guardrails: true } })],
    ['stage0_notification_history', JSON.stringify(history)],
  ]);
  let storageListener; let preferenceListener;
  globalThis.window = { addEventListener: (event, handler) => {
    if (event === 'storage') storageListener = handler;
    if (event === 'stage0-preferences-updated') preferenceListener = handler;
  } };
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    const { useNotificationStore: store } = loadWithMocks(new URL('../frontend/features/notifications/store/useNotificationStore.ts', import.meta.url), { zustand: { create } });
    assert.deepEqual(store.getState().settings.channels, { aiReview: false, gitSync: false, guardrails: true });
    assert.deepEqual(store.getState().notifications, history);
    store.getState().updateChannel('aiReview', true);
    assert.deepEqual(globalThis.window.__STAGE0_PREFERENCES__.notifications.channels, { aiReview: true, gitSync: false, guardrails: true });
    assert.deepEqual(JSON.parse(values.get('stage0_notification_settings')).channels, { softwareUpdates: true, aiReview: false, gitSync: false, guardrails: true });
    assert.deepEqual(JSON.parse(values.get('stage0_notification_history')), history);
    assert.equal(store.getState().unreadCount, 1);
    storageListener({ key: 'stage0_notification_settings', newValue: JSON.stringify({ channels: { softwareUpdates: true, aiReview: false, gitSync: true, guardrails: false } }) });
    assert.deepEqual(store.getState().settings.channels, { aiReview: true, gitSync: false, guardrails: true });
    preferenceListener({ detail: { notifications: { channels: { aiReview: false, gitSync: true, guardrails: false } } } });
    assert.deepEqual(store.getState().settings.channels, { aiReview: false, gitSync: true, guardrails: false });
    assert.deepEqual(store.getState().notifications, history);
  } finally { globalThis.window = originalWindow; globalThis.localStorage = originalStorage; }
});

test('About retains version information, copy and close alongside the updater panel', async () => {
  const harness = componentHarness(); const originalWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  let closed = 0;
  const about = { name: 'Stage0', version: 'fixture-version', packageVersion: 'fixture-package', gitCommit: 'fixture-commit', arch: 'aarch64', author: 'Fixture', releaseDate: 'fixture-date' };
  try {
    const mocks = {
      react: harness.react, '../hooks/useAboutInfo': { useAboutInfo: () => about },
      '../../../common/components/AppLogo': { AppLogo: () => null },
      '../../updates/components/SoftwareUpdatePanel': { SoftwareUpdatePanel: () => harness.react.createElement('button', {}, 'Check for Updates') },
    };
    for (const name of ['Check', 'Copy', 'X']) mocks[`../../../common/components/icons/${name}`] = { [name]: () => null };
    const { AboutModal } = loadWithMocks(new URL('../frontend/features/about/components/AboutModal.tsx', import.meta.url), mocks);
    const nodes = componentNodes(await harness.render(AboutModal, { isOpen: true, onClose: () => { closed++; } }));
    const buttons = nodes.filter((node) => node.type === 'button');
    assert.equal(buttons.length, 5);
    assert.ok(buttons.some((node) => node.props.title === 'Copy version string'));
    assert.ok(buttons.some((node) => node.props.title === 'Copy system and version information'));
    assert.match(JSON.stringify(nodes), /fixture-version/);
    assert.match(JSON.stringify(nodes), /Check for Updates/);
    buttons.find((node) => node.props['aria-label'] === 'Close About dialog').props.onClick();
    assert.equal(closed, 1);
    harness.cleanup();
  } finally { globalThis.window = originalWindow; }
});
