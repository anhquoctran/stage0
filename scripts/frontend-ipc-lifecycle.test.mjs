import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function notificationFixture(t) {
  const registrations = [], calls = [], warnings = [], history = new Map();
  const settings = { channels: { aiReview: true, gitSync: true, guardrails: true } };
  let failure;
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  const services = { platform: { capabilities: { notifications: true }, events: {
    subscribe: (event, callback) => { const pending = deferred(); registrations.push({ event, callback, ...pending }); return pending.promise; },
  } }, notifications: {
    setReady: async input => calls.push(['ready', input]),
    dispatchNotification: async ({ payload }) => {
      calls.push(['dispatch', payload]);
      registrations.find(row => row.event === 'app-notification')?.callback(payload);
      if (failure) throw failure;
    },
    requestPermission: () => { throw Error('Delivery must never request permission'); },
  } };
  const state = { settings, addNotification: value => history.set(value.id, value), markAsRead() {} };
  const { notificationService } = loadWithMocks(new URL('../frontend/features/notifications/services/notificationService.ts', import.meta.url), {
    '@/core/services/runtime/applicationRuntime': { getApplicationServices: () => services },
    '../store/useNotificationStore': { useNotificationStore: { getState: () => state } },
    '../../preferences/store/usePreferencesStore': { usePreferencesStore: {} },
    '../../i18n/i18n': { default: { t: key => key } },
  });
  t.after(() => notificationService.destroy());
  return { notificationService, registrations, calls, warnings, history, settings, services,
    fail: code => { failure = { code }; } };
}

test('notification listeners preserve history and native delivery without a custom host or layout calls', async t => {
  const f = notificationFixture(t), pending = f.notificationService.init();
  assert.equal(f.registrations[0].event, 'app-notification');
  assert.equal(f.calls.length, 0, 'No action readiness is published before listeners exist');
  let stopped = 0;
  f.registrations[0].resolve(() => { stopped++; }); await flush();
  assert.equal(f.registrations[1].event, 'notification-action');
  assert.equal(f.calls.length, 0, 'A partial subscription cannot acknowledge native action readiness');
  f.registrations[1].resolve(() => { stopped++; }); await pending;
  const result = await f.notificationService.notify({ title: 'Review finished', body: 'Two findings', channel: 'aiReview' });
  assert.equal(result.delivery, 'sent');
  assert.equal(f.history.size, 1, 'Stable IDs deduplicate the sender and app-wide event');
  assert.deepEqual(f.calls.map(([name]) => name), ['ready', 'dispatch'], 'No toast-window readiness, positioning, resize or visibility IPC');
  f.notificationService.destroy(); assert.equal(stopped, 2);
});

test('denial and missing authorization keep history and never prompt or create a fallback toast', async t => {
  const f = notificationFixture(t);
  for (const [code, delivery] of [['backend.notifications.permissionDenied', 'denied'],
    ['backend.notifications.permissionRequired', 'permission_required'], ['backend.notifications.unsupportedPlatform', 'unsupported']]) {
    f.fail(code);
    const result = await f.notificationService.notify({ title: 'Finished', channel: 'aiReview' });
    assert.equal(result.delivery, delivery);
    assert.ok(f.history.has(result.notification.id));
  }
  assert.equal(f.calls.length, 3);
  assert.equal(f.settings.channels.aiReview, true, 'OS denial never overwrites preference channel choices');
});

test('disabled categories neither dispatch nor record notification history', async t => {
  const f = notificationFixture(t); f.settings.channels.aiReview = false;
  const result = await f.notificationService.notify({ title: 'Finished', channel: 'aiReview' });
  assert.equal(result.delivery, 'not_requested'); assert.equal(f.calls.length, 0); assert.equal(f.history.size, 0);
});

test('cleanup disposes late notification registration while a remount keeps its own subscription', async t => {
  const f = notificationFixture(t), first = f.notificationService.init();
  f.notificationService.destroy();
  const second = f.notificationService.init();
  let firstStopped = 0, secondStopped = 0;
  f.registrations[1].resolve(() => { secondStopped++; }); await flush();
  f.registrations[0].resolve(() => { firstStopped++; }); await first;
  assert.equal(firstStopped, 1); assert.equal(secondStopped, 0);
  f.registrations[2].resolve(() => { secondStopped++; }); await second;
  f.notificationService.destroy(); assert.equal(secondStopped, 2);
});

test('partial registration failure cleans up and leaves notification initialization retryable', async t => {
  const f = notificationFixture(t), pending = f.notificationService.init();
  let stopped = 0; f.registrations[0].resolve(() => { stopped++; }); await flush();
  const failure = Error('Action listener denied'); f.registrations[1].reject(failure); await pending;
  assert.equal(stopped, 1); assert.equal(f.warnings[0][1], failure);
  const retry = f.notificationService.init();
  f.registrations[2].resolve(() => {}); await flush(); f.registrations[3].resolve(() => {}); await retry;
  assert.equal(f.registrations.length, 4);
});

function permissionFixture(t, initial = 'prompt', supported = true) {
  const runner = hookHarness(), listeners = new Map(), registrations = [];
  const previousWindow = globalThis.window;
  globalThis.window = { addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name) };
  let state = initial, prompts = 0, opened = 0;
  const services = { platform: { capabilities: { notifications: supported }, events: {
    subscribe: (name, handler) => { const pending = deferred(); registrations.push({ name, handler, ...pending }); return pending.promise; },
  } }, notifications: { getPermission: async () => state, requestPermission: async () => { prompts++; return state; }, openSettings: async () => { opened++; } } };
  const { useNotificationPermission } = loadWithMocks(new URL('../frontend/features/notifications/hooks/useNotificationPermission.ts', import.meta.url), {
    react: runner.react, '@/core/services/runtime/useApplicationServices': { useApplicationServices: () => services },
  });
  t.after(() => { runner.cleanup(); globalThis.window = previousWindow; });
  return { render: () => runner.render(useNotificationPermission), cleanup: runner.cleanup, listeners, registrations,
    state: next => { state = next; }, prompts: () => prompts, opened: () => opened };
}

test('OS permission is requested only by explicit action; denial is stable and focus detects later OS changes', async t => {
  const f = permissionFixture(t); f.render(); await flush();
  assert.equal(f.render().permission, 'prompt'); assert.equal(f.prompts(), 0);
  f.state('denied'); await f.render().request();
  assert.equal(f.render().permission, 'denied'); assert.equal(f.prompts(), 1);
  await f.render().openSettings(); assert.equal(f.opened(), 1);
  f.state('granted'); f.listeners.get('focus')(); await flush();
  assert.equal(f.render().permission, 'granted'); assert.equal(f.prompts(), 1);
});

test('permission cleanup releases late subscriptions and rejects callbacks from a disposed window', async t => {
  const f = permissionFixture(t); f.render(); f.cleanup();
  let stopped = 0; f.registrations[0].resolve(() => { stopped++; }); await flush();
  assert.equal(stopped, 1); assert.equal(f.listeners.size, 0);
  assert.equal(f.prompts(), 0);
});

test('browser previews do not call native permission APIs', async t => {
  const f = permissionFixture(t, 'prompt', false);
  assert.equal(f.render().permission, 'unsupported');
  await f.render().request(); assert.equal(f.prompts(), 0); assert.equal(f.registrations.length, 0);
});

test('permission panel offers OS settings after denial instead of repeatedly prompting', async t => {
  const runner = componentHarness();
  t.after(runner.cleanup);
  let permission = 'denied', requested = 0, opened = 0;
  const { NotificationPermissionPanel } = loadWithMocks(new URL('../frontend/features/notifications/components/NotificationPermissionPanel.tsx', import.meta.url), {
    react: runner.react,
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '../hooks/useNotificationPermission': { useNotificationPermission: () => ({
      permission, busy: false, error: false,
      request: async () => { requested++; }, openSettings: async () => { opened++; },
    }) },
  });
  let nodes = componentNodes(await runner.render(NotificationPermissionPanel));
  let buttons = nodes.filter(node => node.type === 'button');
  assert.equal(buttons.length, 1);
  assert.ok(buttons[0].props.children.includes('notifications.permission.settings'));
  await buttons[0].props.onClick(); assert.equal(opened, 1); assert.equal(requested, 0);
  permission = 'prompt';
  nodes = componentNodes(await runner.render(NotificationPermissionPanel));
  buttons = nodes.filter(node => node.type === 'button');
  const request = buttons.find(node => node.props.children.includes('notifications.permission.request'));
  assert.ok(request); assert.equal(requested, 0, 'Rendering onboarding cannot ask for OS permission');
  await request.props.onClick(); assert.equal(requested, 1);
});

test('startup onboarding includes notification authorization alongside launch settings', async t => {
  const runner = componentHarness();
  t.after(runner.cleanup);
  const NotificationPermissionPanel = () => null;
  const { WelcomeStartupTab } = loadWithMocks(new URL('../frontend/features/onboarding/components/WelcomeStartupTab.tsx', import.meta.url), {
    react: runner.react,
    '../../notifications/components/NotificationPermissionPanel': { NotificationPermissionPanel },
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ platform: { capabilities: { backend: true } } }) },
  });
  const nodes = componentNodes(await runner.render(WelcomeStartupTab, {
    settings: { launchAtStartup: true, startInBackground: false, addToPath: false }, onChange() {},
  }));
  assert.equal(nodes.filter(node => node.type === NotificationPermissionPanel).length, 1);
  assert.ok(nodes.some(node => node.props.id === 'onboarding-launch-at-startup'));
});
