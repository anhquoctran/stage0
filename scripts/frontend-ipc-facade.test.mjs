import assert from 'node:assert/strict';
import test from 'node:test';
import * as core from '@tauri-apps/api/core';
import * as events from '@tauri-apps/api/event';
import * as nativeWindow from '@tauri-apps/api/window';
import * as dpi from '@tauri-apps/api/dpi';
import * as nativePath from '@tauri-apps/api/path';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const url = file => new URL(`../frontend/common/services/ipc/${file}.ts`, import.meta.url);
const sdk = {
  '@tauri-apps/api/core': core,
  '@tauri-apps/api/event': events,
  '@tauri-apps/api/window': nativeWindow,
  '@tauri-apps/api/dpi': dpi,
  '@tauri-apps/api/path': nativePath,
};

test('command transport preserves arguments, native options, promise identity and raw rejections', async () => {
  const calls = [], result = { saved: true };
  let response = Promise.resolve(result);
  const invoke = (...args) => { calls.push(args); return response; };
  const { createTauriCommands } = loadWithMocks(url('adapters/tauri/commands'), { '@tauri-apps/api/core': { invoke } });
  const client = createTauriCommands();
  assert.equal(calls.length, 0, 'constructing the adapter makes no native calls');
  const args = { request: { sessionId: 'fixture' } }, options = { headers: { 'x-fixture': 'test' } };
  assert.equal(client.executeCommand('command', args, options), response);
  assert.equal(await response, result);
  assert.equal(calls[0][1], args);
  assert.equal(calls[0][2], options);
  for (const error of ['native failure', { code: 'denied', details: ['original'] }]) {
    response = Promise.reject(error);
    const promise = client.executeCommand('command');
    assert.equal(promise, response);
    await assert.rejects(promise, actual => actual === error);
  }
  const raw = new Uint8Array([1, 2]);
  response = Promise.resolve(undefined);
  await client.executeCommand('binary', raw, options);
  assert.equal(calls.at(-1)[1], raw);
  client.executeCommand('no-args');
  assert.deepEqual(calls.at(-1), ['no-args']);
  const failure = { code: 'synchronous' };
  const sync = loadWithMocks(url('adapters/tauri/commands'), { '@tauri-apps/api/core': { invoke: () => { throw failure; } } });
  assert.throws(() => sync.createTauriCommands().executeCommand('sync'), error => error === failure);
});

test('path-only and event-only adapters load without unrelated SDK mocks or native calls', async () => {
  const pathCalls = [], eventCalls = [];
  const paths = { homeDir: async () => '/native/home', isAbsolute: async () => true,
    join: async (...parts) => { pathCalls.push(parts); return '/native/destination'; } };
  const { createTauriPaths } = loadWithMocks(url('adapters/tauri/paths'), { '@tauri-apps/api/path': paths });
  const pathService = createTauriPaths();
  assert.equal(pathCalls.length, 0);
  assert.equal(await pathService.homeDirectory(), '/native/home');
  assert.equal(await pathService.isAbsolute('/native'), true);
  assert.equal(await pathService.join('/native', 'destination'), '/native/destination');
  assert.deepEqual(pathCalls, [['/native', 'destination']]);
  const stop = () => {}, received = [], options = { target: 'notification-host' };
  const listen = (...args) => { eventCalls.push(args); return Promise.resolve(stop); };
  const { createTauriEvents } = loadWithMocks(url('adapters/tauri/events'), { '@tauri-apps/api/event': { listen } });
  const eventService = createTauriEvents();
  assert.equal(eventCalls.length, 0);
  assert.equal(await eventService.subscribe('event', payload => received.push(payload), options), stop);
  assert.deepEqual(eventCalls[0][2], options);
  const payload = { original: true };
  eventCalls[0][1]({ event: 'event', id: 1, payload });
  assert.equal(received[0], payload, 'callers receive their payload without a native envelope');
});

test('public barrel exposes neutral contracts without any SDK functions/classes or runtime type imports', () => {
  const facade = loadWithMocks(url('index'), {});
  assert.deepEqual(Object.keys(facade), ['UnsupportedCapabilityError']);
  for (const name of ['invoke', 'isTauri', 'Channel', 'listen', 'getCurrentWindow', 'currentMonitor',
    'LogicalSize', 'PhysicalPosition', 'homeDir', 'isAbsolute', 'join']) assert.equal(facade[name], undefined);
  for (const contract of ['CommandTransport', 'EventService', 'PathService', 'PlatformServices',
    'WindowService', 'WindowHandle', 'DisplayMonitor', 'Unsubscribe']) {
    assert.deepEqual(loadWithMocks(url(`contracts/${contract}`), {}), {});
  }
});

test('event subscribers retain independent targets, payload identity and disposal', async () => {
  const registrations = [], received = [], stopped = [];
  const listen = (event, callback, options) => {
    const id = registrations.length;
    registrations.push({ event, callback, options });
    return Promise.resolve(() => stopped.push(id));
  };
  const { createTauriEvents } = loadWithMocks(url('adapters/tauri/events'), { '@tauri-apps/api/event': { listen } });
  const service = createTauriEvents();
  const mainTarget = { target: 'main' }, hostTarget = { target: 'notification-host' };
  const stopMain = await service.subscribe('same-event', payload => received.push(['main', payload]), mainTarget);
  const stopHost = await service.subscribe('same-event', payload => received.push(['host', payload]), hostTarget);
  assert.equal(registrations.length, 2);
  assert.deepEqual(registrations[0].options, mainTarget);
  assert.deepEqual(registrations[1].options, hostTarget);
  const envelope = { event: 'same-event', id: 42, payload: { original: true } };
  registrations.forEach(({ callback }) => callback(envelope));
  assert.equal(received[0][1], envelope.payload);
  assert.equal(received[1][1], envelope.payload);
  stopMain();
  assert.deepEqual(stopped, [0]);
  stopHost();
  assert.deepEqual(stopped, [0, 1]);
  const scopes = [
    [{ kind: 'all' }, { kind: 'Any' }],
    [{ kind: 'application' }, { kind: 'App' }],
    [{ kind: 'label', label: 'main' }, { kind: 'AnyLabel', label: 'main' }],
    [{ kind: 'window', label: 'main' }, { kind: 'Window', label: 'main' }],
    [{ kind: 'webview', label: 'main' }, { kind: 'Webview', label: 'main' }],
    [{ kind: 'webview-window', label: 'main' }, { kind: 'WebviewWindow', label: 'main' }],
  ];
  for (const [target, nativeTarget] of scopes) {
    await service.subscribe('scoped', () => {}, { target });
    assert.deepEqual(registrations.at(-1).options, { target: nativeTarget });
  }
});

test('browser adapter reports unsupported capabilities without fabricating native successes', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  delete globalThis.window;
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
  const { createDefaultPlatform } = loadWithMocks(url('adapters/createDefaultPlatform'), sdk);
  const platform = createDefaultPlatform();
  assert.ok(Object.values(platform.capabilities).every(value => value === false));
  const unsupported = error => error.code === 'UNSUPPORTED_CAPABILITY';
  await assert.rejects(platform.commands.executeCommand('native-only'), unsupported);
  await assert.rejects(platform.commands.executeWithProgress('clone', {}, () => {}), unsupported);
  await assert.rejects(platform.events.subscribe('event', () => {}), unsupported);
  assert.throws(() => platform.windows.current(), unsupported);
  await assert.rejects(platform.windows.currentMonitor(), unsupported);
  await assert.rejects(platform.paths.homeDirectory(), unsupported);
  await assert.rejects(platform.paths.isAbsolute('/home'), unsupported);
  await assert.rejects(platform.paths.join('/home', 'repo'), unsupported);
  // Native adapters still preserve SDK failure behavior if explicitly used
  // without a bridge, instead of swallowing native failures as browser mode.
  const { createTauriPlatform } = loadWithMocks(url('adapters/tauri/createTauriPlatform'), sdk);
  const native = createTauriPlatform();
  await assert.rejects(native.commands.executeCommand('native-only'));
  await assert.rejects(native.events.subscribe('event', () => {}));
  assert.throws(() => native.windows.current());
  assert.throws(() => native.commands.executeWithProgress('clone', {}, () => {}));
  await assert.rejects(native.windows.currentMonitor());
  await assert.rejects(native.paths.homeDirectory());
  await assert.rejects(native.paths.isAbsolute('/home'));
  await assert.rejects(native.paths.join('/home', 'repo'));
});

test('real SDK channels, native options and window units remain inside the adapter', async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const callbacks = new Map(), calls = [];
  const result = { original: true };
  globalThis.window = { __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: 'notification-host' } },
    transformCallback(callback) { const id = callbacks.size + 1; callbacks.set(id, callback); return id; },
    unregisterCallback(id) { callbacks.delete(id); },
    invoke: async (...args) => { calls.push(args); return args[0] === 'plugin:window|current_monitor' ? null : result; },
  } };
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
  const { createTauriPlatform } = loadWithMocks(url('adapters/tauri/createTauriPlatform'), sdk);
  const platform = createTauriPlatform();
  assert.equal(calls.length, 0);
  assert.equal(callbacks.size, 0, 'construction allocates no native channels');
  const messages = [], options = { headers: { 'x-fixture': 'native' } };
  assert.equal(await platform.commands.executeWithProgress('clone', { url: 'repo' }, message => messages.push(message), options), result);
  const channel = calls[0][1].onProgress;
  assert.ok(channel instanceof core.Channel);
  assert.equal(channel.toJSON(), `__CHANNEL__:${channel.id}`);
  callbacks.get(channel.id)({ index: 0, message: { percent: 42 } });
  assert.deepEqual(messages, [{ percent: 42 }]);
  assert.equal(calls[0][1].url, 'repo');
  assert.equal(calls[0][2], options);
  const handle = platform.windows.current();
  assert.equal(handle.label, 'notification-host');
  assert.equal(typeof handle.then, 'undefined');
  assert.equal(handle instanceof nativeWindow.Window, false);
  assert.equal(await platform.windows.currentMonitor(), null);
  await handle.setLogicalSize({ width: 400, height: 84 });
  assert.ok(calls.at(-1)[1].value instanceof dpi.Size);
  assert.deepEqual(calls.at(-1)[1].value.toJSON(), { Logical: { width: 400, height: 84 } });
  await handle.setPhysicalPosition({ x: 16, y: 32 });
  assert.ok(calls.at(-1)[1].value instanceof dpi.Position);
  assert.deepEqual(calls.at(-1)[1].value.toJSON(), { Physical: { x: 16, y: 32 } });
});

test('legacy executable and menu readiness guards stay private to the native adapter', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  globalThis.window = {};
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
  const { createTauriPlatform } = loadWithMocks(url('adapters/tauri/createTauriPlatform'), sdk);
  const { capabilities } = createTauriPlatform();
  assert.equal(capabilities.executableDiscovery, false);
  assert.equal(capabilities.menuUpdates, false);
  globalThis.window.__TAURI_INTERNALS__ = undefined;
  assert.equal(capabilities.executableDiscovery, false);
  assert.equal(capabilities.menuUpdates, true, 'the original menu guard tested property presence');
  globalThis.window.__TAURI_INTERNALS__ = {};
  assert.equal(capabilities.executableDiscovery, true);
  assert.equal(capabilities.menuUpdates, true);
});
