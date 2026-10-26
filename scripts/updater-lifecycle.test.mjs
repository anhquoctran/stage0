import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const { create } = require('zustand');
const status = (revision, phase = 'available') => ({ revision, phase, version: '0.1.12', currentVersion: '0.1.11', supported: true });
const storeUrl = new URL('../frontend/features/updates/store/useSoftwareUpdateStore.ts', import.meta.url);
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('late listener registration is disposed and stale initial snapshots cannot replace newer events', async () => {
  let receive, register, resolveStatus;
  let stops = 0, reads = 0;
  const services = {
    platform: { capabilities: { backend: true }, events: { subscribe: async (_, callback) => {
      receive = callback;
      return new Promise((resolve) => { register = () => resolve(() => stops++); });
    } } },
    softwareUpdates: { getStatus: () => { reads++; return new Promise((resolve) => { resolveStatus = resolve; }); } },
  };
  const { useSoftwareUpdateStore: store } = loadWithMocks(storeUrl, {
    zustand: { create }, '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => services },
  });
  const stopFirst = store.getState().connect();
  stopFirst(); stopFirst(); register(); await flush();
  assert.equal(stops, 1); assert.equal(reads, 0);
  const stop = store.getState().connect(); register(); await flush();
  receive(status(3, 'downloading')); resolveStatus(status(1)); await flush();
  assert.equal(store.getState().status.revision, 3);
  receive(status(2));
  assert.equal(store.getState().status.phase, 'downloading');
  stop(); receive(status(4));
  assert.equal(store.getState().status.revision, 3);
  assert.equal(stops, 2);
});

test('shared consumers use one subscription and command failures retain the last backend state', async () => {
  let starts = 0, stops = 0, checks = 0, finish;
  const services = {
    platform: { capabilities: { backend: true }, events: { subscribe: async () => { starts++; return () => stops++; } } },
    softwareUpdates: {
      getStatus: async () => status(2, 'ready'),
      check: () => { checks++; return new Promise((resolve) => { finish = resolve; }); },
      install: async () => { throw 'Wait for active reviews'; },
    },
  };
  const { useSoftwareUpdateStore: store } = loadWithMocks(storeUrl, {
    zustand: { create }, '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => services },
  });
  const stopA = store.getState().connect(), stopB = store.getState().connect(); await flush();
  assert.equal(starts, 1);
  const first = store.getState().check(), second = store.getState().check();
  assert.equal(checks, 1); finish(status(1)); await Promise.all([first, second]);
  assert.equal(store.getState().status.revision, 2);
  await store.getState().install(true);
  assert.match(store.getState().error, /active reviews/);
  assert.equal(store.getState().pending, false);
  assert.equal(store.getState().status.phase, 'ready');
  stopA(); assert.equal(stops, 0); stopB(); assert.equal(stops, 1);
});

test('updater transport preserves explicit installation confirmation without accepting URLs or bytes', async () => {
  const calls = [];
  const { createSoftwareUpdateService } = loadWithMocks(new URL('../frontend/features/updates/services/transport/createSoftwareUpdateService.ts', import.meta.url), {});
  const service = createSoftwareUpdateService({ executeCommand: async (...args) => calls.push(args) });
  await service.check(); await service.download(); await service.install({ savedWorkConfirmed: false }); await service.install({ savedWorkConfirmed: true });
  assert.deepEqual(calls, [
    ['check_software_update'], ['download_software_update'],
    ['install_software_update', { savedWorkConfirmed: false }], ['install_software_update', { savedWorkConfirmed: true }],
  ]);
});

test('install action requires a fresh saved-work confirmation and displays download progress', async () => {
  const harness = componentHarness(); let installed;
  const state = {
    status: { ...status(2, 'ready'), downloadedBytes: 10, totalBytes: 10 }, pending: false, error: null,
    connect: () => () => {}, check() {}, download() {}, install: (confirmed) => { installed = confirmed; },
  };
  const { SoftwareUpdatePanel } = loadWithMocks(new URL('../frontend/features/updates/components/SoftwareUpdatePanel.tsx', import.meta.url), {
    react: harness.react,
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ platform: { capabilities: { backend: true } } }) },
    '../store/useSoftwareUpdateStore': { useSoftwareUpdateStore: () => state },
    '../hooks/useAutomaticUpdatePreference': { useAutomaticUpdatePreference: () => ({ enabled: true, change() {} }) },
  });
  let nodes = componentNodes(await harness.render(SoftwareUpdatePanel));
  const installButton = (nodes) => nodes.find((node) => node.type === 'button' && JSON.stringify(node.props.children).includes('Install and Restart'));
  assert.equal(installButton(nodes).props.disabled, true);
  nodes.filter((node) => node.type === 'input').at(-1).props.onChange({ target: { checked: true } });
  nodes = componentNodes(await harness.render(SoftwareUpdatePanel));
  assert.equal(installButton(nodes).props.disabled, false);
  installButton(nodes).props.onClick(); assert.equal(installed, true);
  state.status = { ...status(3, 'downloading'), downloadedBytes: 25, totalBytes: 100 };
  nodes = componentNodes(await harness.render(SoftwareUpdatePanel));
  assert.equal(nodes.find((node) => node.type === 'progress').props.value, 25);
  state.status = { ...status(4, 'ready'), downloadedBytes: 100, totalBytes: 100 };
  nodes = componentNodes(await harness.render(SoftwareUpdatePanel));
  assert.equal(installButton(nodes).props.disabled, true);
  harness.cleanup();
});
