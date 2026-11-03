import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const base = new URL('../frontend/features/git/', import.meta.url);

async function menuFixture(t, { viewport = [1024, 768], measured = [210, 42], click = [320, 180] } = {}) {
  const original = { window: globalThis.window, document: globalThis.document };
  const listeners = { document: new Map(), window: new Map() };
  const surface = (map, extra = {}) => ({ ...extra,
    addEventListener: (event, handler, capture) => map.set(event, { handler, capture }),
    removeEventListener: (event, handler, capture) => {
      assert.equal(map.get(event)?.handler, handler);
      assert.equal(map.get(event)?.capture, capture);
      map.delete(event);
    },
  });
  const body = { tagName: 'BODY' };
  globalThis.window = surface(listeners.window, { innerWidth: viewport[0], innerHeight: viewport[1] });
  globalThis.document = surface(listeners.document, { body });
  const harness = componentHarness();
  const inside = {};
  const element = { getBoundingClientRect: () => ({ width: measured[0], height: measured[1] }), contains: (target) => target === inside };
  const { CommitHashContextMenu } = loadWithMocks(new URL('components/CommitHashContextMenu.tsx', base), {
    react: { ...harness.react, useLayoutEffect: harness.react.useEffect },
    'react-dom': { createPortal: (child, target) => {
      child.props.ref.current = element;
      return { type: 'portal', props: { children: child, target } };
    } },
    '../../../common/components/icons/Copy': { Copy: 'Copy' },
  });
  let closed = 0;
  const copied = [];
  const onClose = () => { closed++; };
  const render = (menu) => harness.render(CommitHashContextMenu, { menu, onClose, onCopy: (hash) => copied.push(hash) });
  const tree = await render({ x: click[0], y: click[1], hash: 'first-row' });
  let cleaned = false;
  const cleanup = () => { if (!cleaned) { harness.cleanup(); cleaned = true; } };
  t.after(() => { cleanup(); globalThis.window = original.window; globalThis.document = original.document; });
  return { tree, body, render, listeners, inside, copied, closed: () => closed, cleanup };
}

const menuNode = (tree) => componentNodes(tree).find((node) => node.props?.role === 'menu');

test('right-click menu uses viewport coordinates in a body portal outside the transformed graph dialog', async (t) => {
  const view = await menuFixture(t);
  assert.equal(view.tree.type, 'portal');
  assert.equal(view.tree.props.target, view.body);
  assert.deepEqual(menuNode(view.tree).props.style, { left: 320, top: 180 });
  const updated = await view.render({ x: 260, y: 120, hash: 'different-row' });
  assert.deepEqual(menuNode(updated).props.style, { left: 260, top: 120 });
  componentNodes(updated).find((node) => node.props?.role === 'menuitem').props.onClick();
  assert.deepEqual(view.copied, ['different-row']);
});

test('edge clamping uses measured menu dimensions rather than a fixed height/width guess', async (t) => {
  const view = await menuFixture(t, { measured: [280, 72], click: [1015, 760] });
  assert.deepEqual(menuNode(view.tree).props.style, { left: 736, top: 688 });
});

test('small viewports keep the menu inside an eight-pixel margin', async (t) => {
  const view = await menuFixture(t, { viewport: [180, 80], measured: [164, 60], click: [175, 75] });
  assert.deepEqual(menuNode(view.tree).props.style, { left: 8, top: 12 });
  assert.match(menuNode(view.tree).props.className, /max-w-\[calc\(100vw-16px\)\]/);
});

test('outside dismissal, Escape and viewport changes close the menu and clean every listener', async (t) => {
  const view = await menuFixture(t);
  view.listeners.document.get('mousedown').handler({ target: view.inside });
  assert.equal(view.closed(), 0);
  view.listeners.document.get('mousedown').handler({ target: {} });
  view.listeners.window.get('keydown').handler({ key: 'Escape' });
  view.listeners.window.get('resize').handler();
  assert.equal(view.listeners.window.get('scroll').capture, true);
  view.listeners.window.get('scroll').handler();
  assert.equal(view.closed(), 4);
  view.cleanup();
  assert.equal(view.listeners.document.size, 0);
  assert.equal(view.listeners.window.size, 0);
});

test('Git Graph selects the right-clicked hash and passes client coordinates without scroll offsets', async () => {
  const harness = componentHarness();
  const selected = [], menus = [];
  const { GitGraphModal } = loadWithMocks(new URL('components/GitGraphModal.tsx', base), {
    react: harness.react,
    '../hooks/useGitGraphState': { useGitGraphState: () => ({
      graphLayout: { laneCount: 1 }, commits: [], commitRows: { current: new Map() },
      selectedCommitHash: null, setSelectedCommitHash: (hash) => selected.push(hash),
      setCommitContextMenu: (menu) => menus.push(menu), displayedCommitIndexes: [], matchingCommitIndexes: [],
    }) },
    './git-graph/GitGraphTable': { GitGraphTable: 'Table' },
  });
  const tree = await harness.render(GitGraphModal, { isOpen: true, repoPath: '/repo', onClose() {} });
  const table = componentNodes(tree).find((node) => node.type === 'Table');
  table.props.onContextMenu({ clientX: 420, clientY: 130, pageX: 420, pageY: 900 }, 'first-row');
  assert.deepEqual(selected, ['first-row']);
  assert.deepEqual(menus, [{ x: 420, y: 130, hash: 'first-row' }]);
  harness.cleanup();
});
