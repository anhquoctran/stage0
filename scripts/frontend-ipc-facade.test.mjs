import assert from 'node:assert/strict';
import test from 'node:test';
import * as core from '@tauri-apps/api/core';
import * as events from '@tauri-apps/api/event';
import * as nativeWindow from '@tauri-apps/api/window';
import * as dpi from '@tauri-apps/api/dpi';
import * as nativePath from '@tauri-apps/api/path';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const url = (file) => new URL(`../frontend/common/services/ipc/${file}.ts`, import.meta.url);
const sdk = {
  '@tauri-apps/api/core': core,
  '@tauri-apps/api/event': events,
  '@tauri-apps/api/window': nativeWindow,
  '@tauri-apps/api/dpi': dpi,
  '@tauri-apps/api/path': nativePath,
};

test('invoke-only fixtures preserve arguments, native options, promise identity and raw rejections', async () => {
  const calls = [], result = { saved: true };
  let response = Promise.resolve(result);
  const invoke = (...args) => { calls.push(args); return response; };
  const client = loadWithMocks(url('ipcClient'), { '@tauri-apps/api/core': { invoke } });
  assert.equal(client.invoke, invoke);
  assert.equal(calls.length, 0, 'loading the facade makes no native calls');
  const args = { request: { sessionId: 'fixture' } }, options = { headers: { 'x-fixture': 'test' } };
  assert.equal(client.invoke('command', args, options), response);
  assert.equal(await response, result);
  assert.equal(calls[0][1], args);
  assert.equal(calls[0][2], options);
  for (const error of ['native failure', { code: 'denied', details: ['original'] }]) {
    response = Promise.reject(error);
    const promise = client.invoke('command');
    assert.equal(promise, response);
    await assert.rejects(promise, (actual) => actual === error);
  }
  const raw = new Uint8Array([1, 2]);
  response = Promise.resolve(undefined);
  await client.invoke('binary', raw, options);
  assert.equal(calls.at(-1)[1], raw);
});

test('path-only and event-only fixtures load leaves without unrelated SDK mocks', async () => {
  const pathCalls = [], eventCalls = [];
  const paths = { homeDir: async () => '/native/home', isAbsolute: async () => true,
    join: async (...parts) => { pathCalls.push(parts); return '/native/destination'; } };
  const pathFacade = loadWithMocks(url('ipcPath'), { '@tauri-apps/api/path': paths });
  assert.equal(pathFacade.homeDir, paths.homeDir);
  assert.equal(pathFacade.isAbsolute, paths.isAbsolute);
  assert.equal(pathFacade.join, paths.join);
  assert.equal(pathCalls.length, 0);
  assert.equal(await pathFacade.join('/native', 'destination'), '/native/destination');
  const stop = () => {}, handler = () => {}, options = { target: 'notification-host' };
  const listen = (...args) => { eventCalls.push(args); return Promise.resolve(stop); };
  const eventFacade = loadWithMocks(url('ipcEvents'), { '@tauri-apps/api/event': { listen } });
  assert.equal(eventFacade.listen, listen);
  assert.equal(eventCalls.length, 0);
  assert.equal(await eventFacade.listen('event', handler, options), stop);
  assert.equal(eventCalls[0][1], handler);
  assert.equal(eventCalls[0][2], options);
});

test('barrel and leaves expose the exact SDK functions/classes and types emit no runtime imports', () => {
  const facade = loadWithMocks(url('index'), sdk);
  for (const name of ['invoke', 'isTauri', 'Channel']) assert.equal(facade[name], core[name]);
  assert.equal(facade.listen, events.listen);
  for (const name of ['getCurrentWindow', 'currentMonitor']) assert.equal(facade[name], nativeWindow[name]);
  for (const name of ['LogicalSize', 'PhysicalPosition']) assert.equal(facade[name], dpi[name]);
  for (const name of ['homeDir', 'isAbsolute', 'join']) assert.equal(facade[name], nativePath[name]);
  assert.deepEqual(loadWithMocks(url('types'), {}), {});
});

test('event subscribers retain independent targets, callback envelopes and disposal', async () => {
  const registrations = [], received = [], stopped = [];
  const listen = (event, callback, options) => {
    const id = registrations.length;
    registrations.push({ event, callback, options });
    return Promise.resolve(() => stopped.push(id));
  };
  const facade = loadWithMocks(url('ipcEvents'), { '@tauri-apps/api/event': { listen } });
  const mainTarget = { target: 'main' }, hostTarget = { target: 'notification-host' };
  const stopMain = await facade.listen('same-event', (event) => received.push(['main', event]), mainTarget);
  const stopHost = await facade.listen('same-event', (event) => received.push(['host', event]), hostTarget);
  assert.equal(registrations.length, 2);
  assert.equal(registrations[0].options, mainTarget);
  assert.equal(registrations[1].options, hostTarget);
  const envelope = { event: 'same-event', id: 42, payload: { original: true } };
  registrations.forEach(({ callback }) => callback(envelope));
  assert.equal(received[0][1], envelope);
  assert.equal(received[1][1], envelope);
  stopMain();
  assert.deepEqual(stopped, [0]);
  stopHost();
  assert.deepEqual(stopped, [0, 1]);
});

test('without a native bridge the facade preserves SDK failures instead of fabricating success', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  delete globalThis.window;
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
  const facade = loadWithMocks(url('index'), sdk);
  assert.equal(facade.isTauri(), core.isTauri());
  await assert.rejects(facade.invoke('native-only'));
  await assert.rejects(facade.listen('native-event', () => {}));
  assert.throws(() => facade.getCurrentWindow());
  assert.throws(() => new facade.Channel());
  await assert.rejects(facade.currentMonitor());
  await assert.rejects(facade.homeDir());
  await assert.rejects(facade.isAbsolute('/home'));
  await assert.rejects(facade.join('/home', 'repo'));
  assert.ok(new facade.LogicalSize(400, 84) instanceof dpi.LogicalSize);
  assert.ok(new facade.PhysicalPosition(16, 32) instanceof dpi.PhysicalPosition);
});

test('real SDK channel serialization, native result/options and sync window access cross the facade intact', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const callbacks = new Map(), calls = [];
  const monitor = null, result = { original: true };
  globalThis.window = { __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: 'notification-host' } },
    transformCallback(callback) { const id = callbacks.size + 1; callbacks.set(id, callback); return id; },
    unregisterCallback(id) { callbacks.delete(id); },
    invoke: async (...args) => { calls.push(args); return args[0] === 'plugin:window|current_monitor' ? monitor : result; },
  } };
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window; });
  const facade = loadWithMocks(url('index'), sdk);
  assert.equal(calls.length, 0);
  const messages = [], channel = new facade.Channel((message) => messages.push(message));
  assert.ok(channel instanceof core.Channel);
  assert.equal(channel.toJSON(), `__CHANNEL__:${channel.id}`);
  callbacks.get(channel.id)({ index: 0, message: { percent: 42 } });
  assert.deepEqual(messages, [{ percent: 42 }]);
  const args = { progress: channel }, options = { headers: { 'x-fixture': 'native' } };
  assert.equal(await facade.invoke('clone', args, options), result);
  assert.equal(calls[0][1].progress, channel);
  assert.equal(calls[0][2], options);
  const handle = facade.getCurrentWindow();
  assert.equal(handle.label, 'notification-host');
  assert.equal(typeof handle.then, 'undefined');
  assert.equal(await facade.currentMonitor(), null);
});
