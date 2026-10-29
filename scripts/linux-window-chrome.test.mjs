import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { readFileSync } from 'node:fs';
const en = JSON.parse(readFileSync(new URL('../frontend/features/i18n/locales/en.json', import.meta.url)));
const translate = key => key.split('.').reduce((value, part) => value?.[part], en) ?? key;
import { renderToStaticMarkup } from 'react-dom/server';
import { clsx } from 'clsx';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';

const url = path => new URL(`../frontend/core/${path}`, import.meta.url);
const tick = () => new Promise(resolve => setImmediate(resolve));
const profile = overrides => ({ platform: 'linux', desktop: 'gnome', session: 'wayland', nativeFrame: false,
  controlsLeft: [], controlsRight: ['close'], doubleClickAction: 'maximize', ...overrides });
const labels = tree => componentNodes(tree).filter(node => node.type === 'button').map(node => node.props['aria-label']);

function titleFixture(settings, currentRepo = { name: 'Long repository' }) {
  const calls = [];
  const application = Object.fromEntries(['windowStartDragging', 'windowToggleMaximize', 'windowMinimize'].map(name => [name, async () => { calls.push(name); }]));
  const { TopBarTitleRow } = loadWithMocks(url('components/layout/top-bar/TopBarTitleRow.tsx'), {
    react: { ...React, default: React }, clsx: { clsx },
    '@/core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ application }) },
    '@/core/store/useWindowChromeStore': { useWindowChromeStore: selector => selector({ profile: settings }) },
    '@/common/components/AppLogo': { AppLogo: () => null },
    '@/core/components/layout/MenuBar': { MenuBar: () => React.createElement('nav', { 'aria-label': 'Application menu' }, 'File Edit') },
    '@/core/components/layout/WindowControls': { WindowControls: ({ buttons = ['minimize', 'maximize', 'close'] }) => React.createElement('div', { 'data-controls': buttons.join(',') }) },
    '@/features/git/store/useGitStore': { useGitStore: () => ({ currentRepo, baseBranch: 'main', compareBranch: 'feature' }) },
    '@/features/about/hooks/useAboutInfo': { useAboutInfo: () => ({ packageVersion: '0.1.11' }) },
  });
  return { calls, tree: TopBarTitleRow({ isMac: false }) };
}

test('all three desktops render configured left/right controls and system frames suppress custom controls', () => {
  for (const desktop of ['gnome', 'kde', 'xfce']) {
    const { tree } = titleFixture(profile({ desktop, controlsLeft: ['close'], controlsRight: ['minimize', 'maximize'] }));
    const html = renderToStaticMarkup(tree);
    assert.match(html, /data-tauri-drag-region="false"/);
    assert.match(html, /data-controls="close"/);
    assert.match(html, /data-controls="minimize,maximize"/);
    assert.ok(html.indexOf('data-controls="close"') < html.indexOf('Application menu'));
    assert.match(html, /Long repository/);
    assert.equal(tree.props.onDoubleClick, undefined);
    const system = titleFixture(profile({ desktop, nativeFrame: true }));
    assert.doesNotMatch(renderToStaticMarkup(system.tree), /data-controls=/);
    assert.match(renderToStaticMarkup(system.tree), /Application menu/);
    assert.equal(system.tree.props.onMouseDown, undefined);
  }
});

test('Linux system frames show a menu row without duplicating the native window title', () => {
  for (const desktop of ['gnome', 'kde', 'xfce']) {
    for (const repo of [null, { name: 'Long repository' }]) {
      const { tree } = titleFixture(profile({ desktop, nativeFrame: true }), repo);
      const html = renderToStaticMarkup(tree);
      assert.match(html, /Application menu/);
      assert.equal((html.match(/aria-label="Stage0 version 0\.1\.11"/g) ?? []).length, 1);
      assert.doesNotMatch(html, /Long repository|Virtual MR Sandbox|data-controls=|data-tauri-drag-region/);
      assert.equal(tree.props.onMouseDown, undefined);
      assert.equal(tree.props.onDoubleClick, undefined);
    }
  }
});

test('Linux custom title bars have one drag/double-click owner and preserve desktop action settings', async () => {
  for (const [action, expected] of [['maximize', 'windowToggleMaximize'], ['minimize', 'windowMinimize'], ['none', null]]) {
    const f = titleFixture(profile({ doubleClickAction: action }));
    let prevented = 0;
    const event = { button: 0, detail: 1, target: { closest: () => null }, preventDefault() { prevented++; } };
    f.tree.props.onMouseDown(event);
    f.tree.props.onMouseDown({ ...event, detail: 2 });
    f.tree.props.onMouseDown({ ...event, detail: 2, target: { closest: () => ({}) } });
    f.tree.props.onMouseDown({ ...event, button: 2 });
    await tick();
    assert.deepEqual(f.calls, ['windowStartDragging', ...(expected ? [expected] : [])]);
    assert.equal(prevented, 2);
  }
});

test('Windows keeps its existing controls and framework-owned drag regions', () => {
  const { tree } = titleFixture(profile({ platform: 'windows', desktop: 'unknown', controlsRight: [] }));
  assert.equal(tree.props['data-tauri-drag-region'], true);
  assert.equal(tree.props.onMouseDown, undefined);
  assert.equal(tree.props.onDoubleClick, undefined);
  assert.match(renderToStaticMarkup(tree), /data-controls="minimize,maximize,close"/);
});

test('custom control order/visibility is honored and maximize failure does not falsify its state', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const handlers = new Map();
  globalThis.window = { addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name), location: { search: '' } };
  const restoreWindow = () => original ? Object.defineProperty(globalThis, 'window', original) : delete globalThis.window;
  t.mock.method(console, 'warn', () => {});
  const harness = componentHarness(); t.after(() => { harness.cleanup(); restoreWindow(); });
  let maximized = false, fail = true;
  const calls = [];
  const { WindowControls } = loadWithMocks(url('components/layout/WindowControls.tsx'), {
    react: harness.react,
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '@/core/hooks/useCommandShortcut': { useCommandShortcut: () => ({ title: (_, fallback) => fallback }) },
    '@/core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ application: {
      windowIsMaximized: async () => maximized,
      windowIsFullscreen: async () => false,
      windowToggleMaximize: async () => { calls.push('maximize'); if (fail) throw Error('Compositor denied'); maximized = !maximized; return maximized; },
      windowMinimize: async () => calls.push('minimize'), windowClose: async () => calls.push('close'),
    } }) },
  });
  const render = () => harness.render(WindowControls, { style: 'windows', buttons: ['close', 'maximize', 'minimize'] });
  let tree = await render();
  assert.deepEqual(labels(tree), ['Close', 'Maximize', 'Minimize']);
  await componentNodes(tree).find(node => node.props['aria-label'] === 'Maximize').props.onClick();
  tree = await render();
  assert.deepEqual(labels(tree), ['Close', 'Maximize', 'Minimize']);
  fail = false;
  await componentNodes(tree).find(node => node.props['aria-label'] === 'Maximize').props.onClick();
  tree = await render();
  assert.deepEqual(labels(tree), ['Close', 'Restore Down', 'Minimize']);
  maximized = false; handlers.get('focus')();
  tree = await render();
  assert.deepEqual(labels(tree), ['Close', 'Maximize', 'Minimize']);
  assert.deepEqual(calls, ['maximize', 'maximize']);
});

test('menu placement flips nested menus at the right edge and keeps tall menus inside the viewport', () => {
  const { menuPopupPosition } = loadWithMocks(url('components/layout/menu-bar/menuPopupPosition.ts'), {});
  const next = menuPopupPosition({ left: 800, right: 1000, top: 700, bottom: 730 }, { width: 256, height: 500 }, { width: 1120, height: 800 }, true);
  assert.equal(next.left, 544);
  assert.ok(next.top >= 4 && next.top + 500 <= 796);
  const huge = menuPopupPosition({ left: 10, right: 80, top: 20, bottom: 40 }, { width: 400, height: 1200 }, { width: 320, height: 600 }, false);
  assert.equal(huge.left, 4);
  assert.equal(huge.top, 4);
  assert.equal(huge.maxHeight, 592);
  const above = menuPopupPosition({ left: 15, right: 60, top: 700, bottom: 730 }, { width: 256, height: 200 }, { width: 1120, height: 800 }, false);
  assert.equal(above.top, 498);
});

test('desktop refresh blocks startup until ready, rejects stale responses and cleans up listeners', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const handlers = new Map(), requests = [];
  globalThis.window = { addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  const restoreWindow = () => original ? Object.defineProperty(globalThis, 'window', original) : delete globalThis.window;
  const runner = hookHarness(); t.after(() => { runner.cleanup(); restoreWindow(); });
  const state = { profile: profile({ desktop: 'unknown' }), ready: false };
  const store = Object.assign(selector => selector(state), { setState: next => Object.assign(state, next), getState: () => state });
  const services = { platform: { capabilities: { backend: true } }, application: { getWindowChrome: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) } };
  const { useDesktopWindowChrome } = loadWithMocks(url('hooks/useDesktopWindowChrome.ts'), {
    react: runner.react,
    '@/core/store/useWindowChromeStore': { useWindowChromeStore: store },
    '@/core/services/runtime/useApplicationServices': { useApplicationServices: () => services },
    '@/core/services/startup/startupProgress': { startupProgress: { fail: () => assert.fail('Unexpected startup failure') } },
  });
  assert.equal(runner.render(useDesktopWindowChrome), false);
  requests[0].resolve(profile()); await tick();
  assert.equal(runner.render(useDesktopWindowChrome), true);
  handlers.get('focus')(); handlers.get('stage0-preferences-updated')();
  requests[2].resolve(profile({ desktop: 'kde' })); await tick();
  requests[1].resolve(profile({ desktop: 'xfce' })); await tick();
  assert.equal(state.profile.desktop, 'kde');
  handlers.get('focus')(); runner.cleanup();
  requests[3].resolve(profile({ desktop: 'xfce' })); await tick();
  assert.equal(state.profile.desktop, 'kde');
  assert.equal(handlers.size, 0);
});
