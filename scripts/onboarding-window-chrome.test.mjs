import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

function fixture(t, profile) {
  const runner = componentHarness(), calls = [], handlers = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: '' }, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) };
  t.after(() => { runner.cleanup(); globalThis.window = previousWindow; });
  const application = Object.fromEntries(['windowClose', 'windowMinimize', 'windowStartDragging', 'windowToggleMaximize', 'windowToggleFullscreen']
    .map(name => [name, async () => { calls.push(name); return true; }]));
  application.windowIsMaximized = application.windowIsFullscreen = async () => false;
  const { OnboardingWindowChrome } = loadWithMocks(new URL('../frontend/features/onboarding/components/OnboardingWindowChrome.tsx', import.meta.url), {
    react: runner.react,
    'react-i18next': { useTranslation: () => ({ t: key => key }) },
    '@/core/hooks/useCommandShortcut': { useCommandShortcut: () => ({ title: (_, fallback) => fallback }) },
    '@/core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ application }) },
    '@/core/store/useWindowChromeStore': { useWindowChromeStore: selector => selector({ profile }) },
    '@/common/utils/shortcuts': { isMacOS: () => false },
  });
  return { calls, render: () => runner.render(OnboardingWindowChrome) };
}

test('Welcome shows circular macOS controls in physical left order and uses native close/minimize/fullscreen actions', async t => {
  const f = fixture(t, { platform: 'macos', nativeFrame: false, doubleClickAction: 'maximize' });
  const tree = await f.render(), nodes = componentNodes(tree);
  assert.equal(tree.props.dir, 'ltr', 'RTL languages must not move macOS controls to the right');
  const buttons = nodes.filter(node => Object.hasOwn(node.props, 'data-macos-traffic-light'));
  assert.equal(buttons.length, 3);
  for (const button of buttons) {
    assert.match(button.props.className, /\brounded-full\b/);
    assert.notEqual(button.props.disabled, true);
    await button.props.onClick();
  }
  assert.deepEqual(f.calls, ['windowClose', 'windowMinimize', 'windowToggleFullscreen']);
  assert.match(tree.props.className, /\bcursor-default\b/);
  assert.match(tree.props.className, /\brounded-none\b/);
  const event = { button: 0, detail: 1, target: { closest: () => null }, preventDefault() {} };
  tree.props.onMouseDown(event);
  tree.props.onMouseDown({ ...event, detail: 2 });
  tree.props.onMouseDown({ ...event, target: { closest: () => ({}) } });
  assert.deepEqual(f.calls.slice(3), ['windowStartDragging', 'windowToggleMaximize']);
});

test('Welcome preserves Windows edge controls and Linux desktop button placement', async t => {
  const windows = fixture(t, { platform: 'windows', nativeFrame: false });
  const winTree = await windows.render();
  assert.equal(winTree.props['data-tauri-drag-region'], true);
  assert.equal(winTree.props.onMouseDown, undefined);
  assert.deepEqual(componentNodes(winTree).filter(node => node.type === 'button').map(node => node.props['data-window-control']), ['minimize', 'maximize', 'close']);
  const linux = fixture(t, { platform: 'linux', nativeFrame: false, controlsLeft: ['close'], controlsRight: ['minimize', 'maximize'] });
  const tree = await linux.render();
  assert.equal(tree.props['data-tauri-drag-region'], false);
  assert.deepEqual(componentNodes(tree).filter(node => node.type === 'button').map(node => node.props['data-window-control']), ['close', 'minimize', 'maximize']);
});

test('Welcome does not duplicate controls on Linux system frames', async t => {
  const f = fixture(t, { platform: 'linux', nativeFrame: true });
  assert.equal(await f.render(), null);
  assert.deepEqual(f.calls, []);
});
