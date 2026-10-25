import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHarness } from './helpers/hookHarness.mjs';
import { loadWithMocks } from './helpers/componentHarness.mjs';

test('Preferences Escape respects consumed events, IME, child dialogs and listener cleanup', (t) => {
  const runner = hookHarness(), listeners = new Map();
  const previous = globalThis.window;
  globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); } };
  t.after(() => { runner.cleanup(); globalThis.window = previous; });
  const { usePreferencesDismiss } = loadWithMocks(
    new URL('../frontend/features/preferences/hooks/usePreferencesDismiss.ts', import.meta.url), { react: runner.react });
  let cancelled = 0, prevented = 0;
  const props = { isOpen: false, hasChildDialog: false, onCancel: () => { cancelled++; } };
  const event = (overrides = {}) => ({ key: 'Escape', defaultPrevented: false, isComposing: false,
    preventDefault: () => { prevented++; }, ...overrides });
  runner.render(usePreferencesDismiss, props);
  assert.equal(listeners.size, 0);
  props.isOpen = true; runner.render(usePreferencesDismiss, props);
  assert.equal(listeners.size, 1);
  listeners.get('keydown')(event({ key: 'Enter' }));
  listeners.get('keydown')(event({ defaultPrevented: true }));
  listeners.get('keydown')(event({ isComposing: true }));
  assert.equal(cancelled, 0); assert.equal(prevented, 0);
  listeners.get('keydown')(event());
  assert.equal(cancelled, 1); assert.equal(prevented, 1);
  props.hasChildDialog = true; runner.render(usePreferencesDismiss, props);
  assert.equal(listeners.size, 0, 'the child dialog owns Escape');
  props.hasChildDialog = false; runner.render(usePreferencesDismiss, props);
  assert.equal(listeners.size, 1);
  props.isOpen = false; runner.render(usePreferencesDismiss, props);
  assert.equal(listeners.size, 0);
});

test('Preferences dismissal has no DOM work in a headless draft render', (t) => {
  const previous = globalThis.window;
  delete globalThis.window;
  const runner = hookHarness();
  t.after(() => { runner.cleanup(); if (previous !== undefined) globalThis.window = previous; });
  const { usePreferencesDismiss } = loadWithMocks(
    new URL('../frontend/features/preferences/hooks/usePreferencesDismiss.ts', import.meta.url), { react: runner.react });
  assert.doesNotThrow(() => runner.render(usePreferencesDismiss,
    { isOpen: true, hasChildDialog: false, onCancel: () => assert.fail('No keyboard event was dispatched') }));
});
