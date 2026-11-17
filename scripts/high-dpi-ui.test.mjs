import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const url = new URL('../frontend/common/utils/displayScale.ts', import.meta.url);
function display(t, initial = 1) {
  const previous = globalThis.window;
  const resize = new Set(), queries = [];
  globalThis.window = { devicePixelRatio: initial,
    addEventListener: (_, callback) => resize.add(callback),
    removeEventListener: (_, callback) => resize.delete(callback),
    matchMedia: query => {
      const listeners = new Set();
      const media = { query, listeners, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
      queries.push(media); return media;
    },
  };
  t.after(() => { globalThis.window = previous; });
  return { scale: loadWithMocks(url, {}), resize, queries,
    move(value) { window.devicePixelRatio = value; for (const callback of [...queries.at(-1).listeners]) callback(); } };
}

test('raster scale keeps fractional DPI and bounds invalid or extreme values', t => {
  const f = display(t);
  for (const value of [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 8]) {
    window.devicePixelRatio = value; assert.equal(f.scale.readDisplayScale(), value);
  }
  for (const value of [0, -1, NaN, Infinity, undefined, '2']) assert.equal(f.scale.normalizeDisplayScale(value), 1);
  assert.equal(f.scale.normalizeDisplayScale(100), 8);
});

test('mixed-monitor watcher re-arms resolution queries, shares listeners and cleans up', t => {
  const f = display(t); let first = 0, second = 0;
  const stop = f.scale.subscribeDisplayScale(() => first++);
  const stopSecond = f.scale.subscribeDisplayScale(() => second++);
  assert.equal(f.resize.size, 1); assert.equal(f.queries.length, 1);
  for (const value of [1.25, 2, 3, 1.5, 1]) {
    const old = f.queries.at(-1); f.move(value);
    assert.equal(old.listeners.size, 0);
    assert.equal(f.queries.at(-1).query, `(resolution: ${value}dppx)`);
  }
  assert.equal(first, 5); assert.equal(second, 5);
  for (const callback of f.resize) callback(); assert.equal(first, 5, 'Unchanged resize never republishes');
  stop(); f.move(2); assert.equal(first, 5); assert.equal(second, 6);
  stopSecond(); assert.equal(f.resize.size, 0); assert.equal(f.queries.at(-1).listeners.size, 0);
});

test('shared DPI watcher retains duplicate subscriptions independently and falls back to resize', t => {
  const f = display(t); delete window.matchMedia;
  let count = 0; const callback = () => count++;
  const stop = f.scale.subscribeDisplayScale(callback), second = f.scale.subscribeDisplayScale(callback);
  stop(); window.devicePixelRatio = 1.5; for (const listener of f.resize) listener();
  assert.equal(count, 1); second(); assert.equal(f.resize.size, 0);
});

test('native DPI paths preserve logical sizing, clamp the work area and retain runtime-owned scaling', () => {
  const native = fs.readFileSync('backend/src/core/window_manager/display_geometry.rs', 'utf8');
  assert.match(native, /work_area\(\)/); assert.match(native, /\/ scale/);
  assert.match(native, /saturating_sub/); assert.match(native, /set_min_size\(None/);
  assert.match(native, /is_maximized/); assert.match(native, /is_fullscreen/);
  assert.match(native, /startup_geometry/);
  assert.ok(native.indexOf('async_runtime::spawn') < native.indexOf('dispatch.run_on_main_thread'), 'DPI geometry reads must be queued after the native event');
  for (const path of ['backend/src/core/window_manager/startup_window.rs', 'backend/src/core/commands/window.rs', 'backend/src/core/window_manager/preferences_window.rs'])
    assert.match(fs.readFileSync(path, 'utf8'), /display_geometry::(?:configure_window|window_geometry)/);
  assert.match(fs.readFileSync('backend/src/lib.rs', 'utf8'), /WindowEvent::ScaleFactorChanged/);
  const css = fs.readFileSync('frontend/core/styles/ui-density.css', 'utf8');
  assert.doesNotMatch(css, /devicePixelRatio|zoom:|scale\(/, 'Density must not multiply OS scaling');
});

function badgeFixture(t) {
  const keys = ['window', 'document', 'navigator'];
  const saved = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const canvases = [], overlays = [], warnings = [];
  const warn = console.warn; console.warn = (...args) => warnings.push(args);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Windows' } });
  globalThis.window = { devicePixelRatio: 1.25 };
  globalThis.document = { createElement: () => {
    const canvas = { width: 0, height: 0, transforms: [],
      getContext: () => ({ setTransform: (...args) => canvas.transforms.push(args), beginPath() {}, arc() {}, fill() {}, stroke() {} }),
      toBlob: callback => { canvas.encode = callback; } };
    canvases.push(canvas); return canvas;
  } };
  const { syncUnreadBadge } = loadWithMocks(new URL('../frontend/features/notifications/services/notificationBadgeService.ts', import.meta.url), {
    '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({
      platform: { capabilities: { windows: true }, windows: { current: () => ({ setOverlayIcon: async value => overlays.push(value) }) } },
    }) },
  });
  t.after(() => {
    console.warn = warn;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  });
  return { canvases, overlays, warnings, syncUnreadBadge };
}

test('badge backing size follows fractional DPI and stale encoding cannot resurrect a cleared badge', async t => {
  const f = badgeFixture(t);
  const pending = f.syncUnreadBadge(1);
  const canvas = f.canvases[0];
  assert.deepEqual([canvas.width, canvas.height], [20, 20]);
  assert.deepEqual(canvas.transforms[0], [1.25, 0, 0, 1.25, 0, 0]);
  await f.syncUnreadBadge(0);
  canvas.encode({ arrayBuffer: async () => new Uint8Array([1]).buffer });
  await pending;
  assert.deepEqual(f.overlays, [undefined]);
  window.devicePixelRatio = 3;
  const next = f.syncUnreadBadge(1);
  assert.equal(f.canvases[1].width, 48);
  f.canvases[1].encode({ arrayBuffer: async () => new Uint8Array([2]).buffer }); await next;
  assert.deepEqual([...f.overlays.at(-1)], [2]);
  await f.syncUnreadBadge(2); assert.equal(f.canvases.length, 2, 'Reuse the raster at unchanged DPI');
});

test('badge encoding failures are retryable at the same DPI', async t => {
  const f = badgeFixture(t), first = f.syncUnreadBadge(1);
  f.canvases[0].encode(null); await first;
  assert.equal(f.warnings.length, 1);
  const retry = f.syncUnreadBadge(1); assert.equal(f.canvases.length, 2);
  f.canvases[1].encode({ arrayBuffer: async () => new Uint8Array([3]).buffer }); await retry;
  assert.deepEqual([...f.overlays[0]], [3]);
});

test('vector identicons retain mirrored pixels without duplicate center keys', () => {
  const { createPixels } = loadWithMocks(new URL('../frontend/features/git/utils/createPixels.ts', import.meta.url), {});
  for (const seed of [0, 1, 123, 0xffffffff]) {
    const pixels = createPixels(seed), keys = new Set(pixels.map(({ x, y }) => `${x}-${y}`));
    assert.equal(keys.size, pixels.length);
    for (const { x, y } of pixels) assert.ok(keys.has(`${4 - x}-${y}`));
  }
});

test('locally bundled raster preset logos have enough source pixels for 24 CSS px at 4x DPI', () => {
  for (const name of ['fork', 'github-desktop', 'sourcetree']) {
    const png = fs.readFileSync(`frontend/features/preferences/assets/keymap-logos/${name}.png`);
    assert.ok(png.readUInt32BE(16) >= 24 * 4, name);
    assert.ok(png.readUInt32BE(20) >= 24 * 4, name);
  }
});
