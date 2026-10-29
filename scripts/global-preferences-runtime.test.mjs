import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';
const url = path => new URL(`../frontend/${path}`, import.meta.url);
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

test('all repo windows use one app-wide preferences listener, coalesce reloads, and catch changes during bootstrap', async t => {
  const previous = globalThis.window, subscriptions = [], reads = [], published = [];
  let disposed = 0, unload;
  globalThis.window = { __STAGE0_PREFERENCES_REVISION__: 'r0', addEventListener: (name, fn) => { if (name === 'beforeunload') unload = fn; } };
  t.after(() => { globalThis.window = previous; });
  const { startGlobalPreferencesRuntime } = loadWithMocks(url('core/services/runtime/globalPreferencesRuntime.ts'), {
    './applicationRuntime': { getApplicationServices: () => ({ platform: { capabilities: { preferencesFile: true, events: true }, events: {
      subscribe: async (name, receive, options) => { subscriptions.push({ name, receive, options }); return () => { disposed++; }; },
    } } }) },
    '@/features/preferences/services/preferencesJsonService': { preferencesJsonService: { load: () => {
      const pending = deferred(); reads.push(pending); return pending.promise;
    } } },
    '@/features/git/services/synchronizeWorkspacePreferences': { synchronizeWorkspacePreferences: settings => published.push(settings) },
  });
  const first = startGlobalPreferencesRuntime();
  assert.equal(startGlobalPreferencesRuntime(), first);
  await tick();
  assert.equal(subscriptions.length, 1);
  assert.equal(subscriptions[0].name, 'preferences-changed');
  assert.deepEqual(subscriptions[0].options, { target: { kind: 'application' } });
  assert.equal(reads.length, 1, 'Reload after subscription covers preferences changed during bootstrap');
  reads[0].resolve({ settings: { appearance: { themeMode: 'dark' } } }); await first;
  subscriptions[0].receive('r1'); subscriptions[0].receive('r2'); subscriptions[0].receive('r3');
  assert.equal(reads.length, 2, 'Only one load may be in flight');
  reads[1].resolve({ settings: { appearance: { themeMode: 'light' } } }); await tick();
  assert.equal(reads.length, 3, 'A burst must still read the latest state once the pending load finishes');
  reads[2].resolve({ settings: { appearance: { themeMode: 'dark', language: 'vi' }, sandbox: { type: 'docker' } } }); await tick();
  assert.equal(published.at(-1).appearance.language, 'vi');
  assert.equal(published.at(-1).sandbox.type, 'docker');
  unload(); subscriptions[0].receive('r4');
  assert.equal(disposed, 1); assert.equal(reads.length, 3);
});

test('global workspace synchronization changes app-level sandbox/Git selection without replacing repo state', () => {
  const repo = { id: 'repo-b', local_path: '/workspace/b' }; let refreshes = 0;
  const git = { currentRepo: repo, activeSandboxType: 'in_memory', refreshDiff: () => refreshes++ };
  const binary = { activeBinaryId: 'old', activeBinaryPath: 'git', binaries: [{ id: 'new', is_active: false }, { id: 'old', is_active: true }] };
  const store = state => ({ getState: () => state, setState: patch => Object.assign(state, typeof patch === 'function' ? patch(state) : patch) });
  const { synchronizeWorkspacePreferences } = loadWithMocks(url('features/git/services/synchronizeWorkspacePreferences.ts'), {
    '../store/useGitStore': { useGitStore: store(git) }, '../store/useGitBinaryStore': { useGitBinaryStore: store(binary) },
  });
  const settings = { sandbox: { type: 'docker' }, git: { binaryId: 'new', binaryPath: '/bin/new-git' } };
  synchronizeWorkspacePreferences(settings); synchronizeWorkspacePreferences(settings);
  assert.equal(git.currentRepo, repo); assert.equal(git.activeSandboxType, 'docker'); assert.equal(refreshes, 1);
  assert.equal(binary.activeBinaryId, 'new'); assert.equal(binary.activeBinaryPath, '/bin/new-git');
  assert.deepEqual(binary.binaries.map(item => item.is_active), [true, false]);
  synchronizeWorkspacePreferences({});
  assert.equal(git.activeSandboxType, 'in_memory');
  assert.equal(binary.activeBinaryId, 'system-default');
  assert.equal(binary.activeBinaryPath, 'git');
  assert.equal(git.currentRepo, repo, 'Deleting app sections in JSONC must reset settings without closing a repository');
});

test('persisted app notifications update appearance, AI agents, reviewer profiles and notification preferences together', t => {
  const previous = globalThis.window, oldStorage = globalThis.localStorage;
  const listeners = new Map();
  globalThis.window = { __STAGE0_PREFERENCES__: { schemaVersion: 1 }, addEventListener: (name, handler) => {
    const handlers = listeners.get(name) ?? []; handlers.push(handler); listeners.set(name, handlers);
  } };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  t.after(() => { globalThis.window = previous; globalThis.localStorage = oldStorage; });
  const mocks = {
    '@/core/services/runtime/applicationRuntime': { getApplicationServices: () => ({ platform: { capabilities: { backend: false, windows: false, keychain: false } } }) },
    '@/features/git/store/useGitStore': { useGitStore: { getState: () => ({ showToast() {} }) } },
  };
  const { usePreferencesStore } = loadWithMocks(url('features/preferences/store/usePreferencesStore.ts'), mocks);
  const { useAiMcpStore } = loadWithMocks(url('features/ai/store/useAiMcpStore.ts'), mocks);
  const { useBotReviewersStore } = loadWithMocks(url('features/ai/store/useBotReviewersStore.ts'), mocks);
  const { useNotificationStore } = loadWithMocks(url('features/notifications/store/useNotificationStore.ts'), mocks);
  const { useThemeStore } = loadWithMocks(url('core/store/useThemeStore.ts'), mocks);
  const settings = { schemaVersion: 1, appearance: { themeMode: 'light', uiFont: { fontFamily: 'Inter' }, viewerFont: { fontSize: 17 } },
    general: { launchAtStartup: false, startInBackground: true, addToPath: true },
    ai: { aiConfig: { provider: 'ollama', model: 'fixture-model' }, externalAgents: [{ id: 'agent', name: 'Fixture', command: 'agent', args: [] }] },
    reviewers: [{ id: 'reviewer', name: 'Fixture reviewer', enabled: true, isBuiltin: false }],
    notifications: { channels: { aiReview: false, gitSync: true, guardrails: false } } };
  const publish = value => {
    window.__STAGE0_PREFERENCES__ = value;
    for (const handler of listeners.get('stage0-preferences-updated')) handler({ detail: value });
  };
  publish(settings);
  assert.equal(useThemeStore.getState().themeMode, 'light');
  assert.equal(usePreferencesStore.getState().uiFontFamily, 'Inter');
  assert.equal(usePreferencesStore.getState().fontSize, 17);
  assert.equal(usePreferencesStore.getState().launchAtStartup, false);
  assert.equal(usePreferencesStore.getState().startInBackground, true);
  assert.equal(usePreferencesStore.getState().addToPath, true);
  assert.equal(useAiMcpStore.getState().aiConfig.provider, 'ollama');
  assert.equal(useAiMcpStore.getState().externalAgents[0].id, 'agent');
  assert.ok(useBotReviewersStore.getState().globalReviewers.some(item => item.id === 'reviewer'));
  assert.equal(useNotificationStore.getState().settings.channels.aiReview, false);
  publish({ schemaVersion: 1 });
  assert.equal(usePreferencesStore.getState().uiFontFamily, 'IBM Plex Sans');
  assert.equal(usePreferencesStore.getState().fontSize, 13);
  assert.equal(usePreferencesStore.getState().launchAtStartup, true);
  assert.equal(usePreferencesStore.getState().addToPath, false);
  assert.equal(useAiMcpStore.getState().externalAgents.length, 0);
  assert.ok(!useBotReviewersStore.getState().globalReviewers.some(item => item.id === 'reviewer'));
  assert.equal(useNotificationStore.getState().settings.channels.aiReview, true);
});
