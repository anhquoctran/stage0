import assert from 'node:assert/strict';
import test from 'node:test';
import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { componentHarness, loadWithMocks } from './helpers/componentHarness.mjs';

const flush = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function hostFixture(t, monitor = null) {
  const registrations = [], calls = [], warnings = [], toasts = [], mounts = [];
  const previous = new Map(['window', 'document', 'navigator'].map((key) =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Mac', platform: 'Mac' } });
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.document = { getElementById: () => null, documentElement: { style: {} },
    body: { style: {}, classList: { add() {}, remove() {} } } };
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  t.after(() => {
    mounts.forEach((mount) => mount.dispose());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const useNotificationStore = (selector) => selector({ activeToasts: [{ id: 'visible' }] });
  useNotificationStore.getState = () => ({ showToast: (toast) => toasts.push(toast) });
  const host = {
    setSize: async (size) => calls.push(['size', size]),
    setPosition: async (position) => calls.push(['position', position]),
    show: async () => calls.push(['show']),
  };

  async function mount() {
    const runner = componentHarness();
    const react = { ...runner.react, useLayoutEffect: runner.react.useEffect };
    const { NotificationHost } = loadWithMocks(
      new URL('../frontend/features/notifications/components/NotificationHost.tsx', import.meta.url), {
        react,
        '@tauri-apps/api/core': { invoke: async (...args) => { calls.push(args); } },
        '@tauri-apps/api/event': { listen: (event, callback) => {
          const pending = deferred();
          registrations.push({ ...pending, event, callback });
          return pending.promise;
        } },
        '@tauri-apps/api/window': { getCurrentWindow: () => host, currentMonitor: async () => monitor },
        '@tauri-apps/api/dpi': { LogicalSize, PhysicalPosition },
        './ToastContainer': { ToastContainer: () => null },
        '../store/useNotificationStore': { useNotificationStore },
        '../../../core/store/useThemeStore': { useThemeStore: { getState: () => ({ themeMode: 'dark' }) },
          resolveTheme: (theme) => theme, applyThemeToDocument() {} },
      });
    let disposed = false;
    const instance = { tree: await runner.render(NotificationHost), dispose() {
      if (!disposed) { disposed = true; runner.cleanup(); }
    } };
    mounts.push(instance);
    return instance;
  }
  return { mount, registrations, calls, warnings, toasts };
}

test('notification readiness follows successful listener registration and cleanup releases it', async (t) => {
  const f = hostFixture(t), mounted = await f.mount();
  assert.equal(f.registrations.length, 1);
  assert.equal(f.registrations[0].event, 'stage0-toast');
  assert.deepEqual(f.calls, [], 'pending registration must not publish readiness');
  let stopped = 0;
  f.registrations[0].resolve(() => { stopped++; });
  await flush();
  assert.deepEqual(f.calls, [['notification_host_ready']]);
  f.registrations[0].callback({ payload: { id: 'native-toast', title: 'Saved', level: 'success' } });
  assert.equal(f.toasts[0].id, 'native-toast');
  assert.equal(f.toasts[0].variant, 'success');
  mounted.dispose();
  assert.equal(stopped, 1);
});

test('notification cleanup disposes a late registration while a remount keeps its own subscription', async (t) => {
  const f = hostFixture(t), first = await f.mount();
  first.dispose();
  const second = await f.mount();
  let firstStopped = 0, secondStopped = 0;
  f.registrations[1].resolve(() => { secondStopped++; });
  await flush();
  f.registrations[0].resolve(() => { firstStopped++; });
  await flush();
  assert.equal(firstStopped, 1);
  assert.equal(secondStopped, 0);
  assert.deepEqual(f.calls, [['notification_host_ready']], 'disposed setup never announces readiness');
  second.dispose();
  assert.equal(secondStopped, 1);
});

test('notification registration failure is reported without announcing readiness', async (t) => {
  const f = hostFixture(t);
  await f.mount();
  const error = { code: 'event-denied' };
  f.registrations[0].reject(error);
  await flush();
  assert.deepEqual(f.calls, []);
  assert.equal(f.warnings.length, 1);
  assert.equal(f.warnings[0][1], error);
});

test('notification sizing preserves logical dimensions, physical placement and native show order', async (t) => {
  const f = hostFixture(t, { scaleFactor: 2, workArea: {
    size: { width: 2880, height: 1800 }, position: { x: 100, y: 200 },
  } });
  const mounted = await f.mount();
  await mounted.tree.props.onHeightChange(100);
  assert.deepEqual(f.calls.map(([name]) => name), ['size', 'position', 'show']);
  assert.ok(f.calls[0][1] instanceof LogicalSize);
  assert.deepEqual([f.calls[0][1].width, f.calls[0][1].height], [400, 112]);
  assert.ok(f.calls[1][1] instanceof PhysicalPosition);
  assert.deepEqual([f.calls[1][1].x, f.calls[1][1].y], [2148, 232]);
});

test('notification sizing accepts native monitor-null without fabricating a position', async (t) => {
  const f = hostFixture(t), mounted = await f.mount();
  await mounted.tree.props.onHeightChange(100);
  assert.deepEqual(f.calls.map(([name]) => name), ['size', 'show']);
  assert.deepEqual([f.calls[0][1].width, f.calls[0][1].height], [400, 112]);
});

test('notification service releases partial registration and preserves its failure path', async (t) => {
  const calls = [], error = { code: 'second-listener-denied' };
  t.mock.method(console, 'warn', (...args) => calls.push(['warn', ...args]));
  const { notificationService } = loadWithMocks(
    new URL('../frontend/features/notifications/services/notificationService.ts', import.meta.url), {
      '@tauri-apps/api/core': { isTauri: () => true },
      '@tauri-apps/api/event': { listen: async (event) => {
        calls.push(['listen', event]);
        if (event === 'notification-action') throw error;
        return () => calls.push(['stop', event]);
      } },
      '../store/useNotificationStore': { useNotificationStore: {} },
      '../../preferences/store/usePreferencesStore': { usePreferencesStore: {} },
    });
  await notificationService.init();
  assert.deepEqual(calls.slice(0, 3), [
    ['listen', 'app-notification'], ['listen', 'notification-action'], ['stop', 'app-notification'],
  ]);
  assert.equal(calls[3][0], 'warn');
  assert.equal(calls[3][2], error);
  calls.length = 0;
  await notificationService.init();
  assert.equal(calls[0][0], 'listen', 'a registration failure leaves init retryable');
});
