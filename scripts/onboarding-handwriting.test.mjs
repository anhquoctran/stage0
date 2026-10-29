import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';

const url = path => new URL(`../frontend/features/onboarding/${path}`, import.meta.url);
const { handwritingKeyframes } = loadWithMocks(url('utils/handwritingKeyframes.ts'), {});

test('pen strokes draw sequentially by length, pause for pen lifts, hold and fade on one cycle', () => {
  const frames = handwritingKeyframes([100, 200, 2]);
  assert.equal(frames.length, 3);
  for (const stroke of frames) {
    assert.equal(stroke[0].strokeDashoffset, '1');
    assert.equal(stroke[3].strokeDashoffset, '0');
    assert.equal(stroke[4].offset, 0.84);
    assert.equal(stroke[4].opacity, 1);
    assert.equal(stroke[5].opacity, 0);
    assert.equal(stroke[6].offset, 1);
    assert.ok(stroke[3].offset > stroke[2].offset);
  }
  assert.equal(frames[0][2].offset, 0.05);
  assert.ok(frames[0][3].offset < frames[1][2].offset);
  assert.ok(frames[1][3].offset < frames[2][2].offset);
  const time = stroke => stroke[3].offset - stroke[2].offset;
  assert.ok(Math.abs(time(frames[1]) / time(frames[0]) - 2) < 1e-9);
  assert.ok(frames[2][3].offset <= 0.62);
  assert.deepEqual(handwritingKeyframes([]), []);
});

test('Reduce Motion changes cancel every pen animation; locale changes and unmount clean up old strokes', t => {
  const runner = hookHarness(); t.after(runner.cleanup);
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  const listeners = new Set(), calls = [];
  const motion = { matches: false, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
  globalThis.window = { matchMedia: () => motion };
  globalThis.document = { timeline: { currentTime: 42 } };
  t.after(() => { globalThis.window = oldWindow; globalThis.document = oldDocument; });
  const paths = [100, 200, 10].map(length => ({
    getTotalLength: () => length,
    animate(frames, options) {
      const animation = { cancel: () => { animation.cancelled = true; } };
      calls.push({ frames, options, animation }); return animation;
    },
  }));
  const ref = { current: { querySelectorAll: () => paths } };
  const { useGreetingHandwriting } = loadWithMocks(url('hooks/useGreetingHandwriting.ts'), {
    react: { ...runner.react, useLayoutEffect: runner.react.useEffect },
  });
  const render = language => runner.render(() => useGreetingHandwriting(ref, language));
  render('vi');
  assert.equal(calls.length, 3);
  assert.ok(calls.every(({ options, animation }) => options.duration === 7000 && options.iterations === Infinity && animation.startTime === 42));
  render('vi'); assert.equal(calls.length, 3, 'A normal rerender must not restart the writing');
  motion.matches = true; listeners.forEach(fn => fn());
  assert.ok(calls.every(({ animation }) => animation.cancelled));
  assert.equal(calls.length, 3, 'Reduced Motion leaves the complete underlying artwork visible');
  motion.matches = false; listeners.forEach(fn => fn());
  assert.equal(calls.length, 6);
  render('ar');
  assert.equal(calls.length, 9);
  assert.ok(calls.slice(0, 6).every(({ animation }) => animation.cancelled));
  assert.equal(listeners.size, 1);
  runner.cleanup();
  assert.equal(listeners.size, 0);
  assert.ok(calls.every(({ animation }) => animation.cancelled));
});
