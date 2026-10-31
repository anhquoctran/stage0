import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

// Small propagation fixture: an outside dialog may stop bubbling, but document
// capture still receives the interaction. It does not require a browser DOM.
function eventSurface() {
  const listeners = new Map();
  const document = {
    body: { nodeName: 'BODY' },
    documentElement: { nodeName: 'HTML' },
    addEventListener(type, callback, capture) {
      const entries = listeners.get(type) ?? [];
      entries.push({ callback, capture });
      listeners.set(type, entries);
    },
    removeEventListener(type, callback, capture) {
      listeners.set(type, (listeners.get(type) ?? []).filter((entry) =>
        entry.callback !== callback || entry.capture !== capture));
    },
  };
  const inside = {};
  const outside = {};
  const container = { ownerDocument: document, contains: (target) => target === inside };
  return {
    document, container, inside, outside,
    count: () => [...listeners.values()].reduce((sum, entries) => sum + entries.length, 0),
    dispatch(type, target, { stopped = false, path = [target] } = {}) {
      const event = new Event(type, { cancelable: true });
      Object.defineProperty(event, 'target', { value: target });
      event.composedPath = () => path;
      for (const entry of [...listeners.get(type) ?? []]) {
        if (entry.capture || !stopped) entry.callback(event);
      }
      assert.equal(event.defaultPrevented, false, 'outside activation must not be swallowed');
    },
  };
}

test('outside dismissal handles stopped bubbling, assistive clicks, focus and listener cleanup', async () => {
  const surface = eventSurface();
  const harness = componentHarness();
  const { useOutsideDismiss } = loadWithMocks(new URL('../frontend/common/hooks/useOutsideDismiss.ts', import.meta.url), {
    react: harness.react,
  });
  const ref = { current: surface.container };
  let dismissed = 0;
  const Hook = ({ open, dismiss }) => useOutsideDismiss(ref, open, dismiss);
  try {
    await harness.render(Hook, { open: false, dismiss: () => dismissed++ });
    assert.equal(surface.count(), 0);
    await harness.render(Hook, { open: true, dismiss: () => dismissed++ });
    surface.dispatch('pointerdown', surface.inside);
    surface.dispatch('click', surface.inside);
    surface.dispatch('focusin', surface.inside);
    surface.dispatch('focusin', surface.document.body);
    surface.dispatch('focusin', surface.document.documentElement);
    surface.dispatch('focusin', surface.document);
    surface.dispatch('pointerdown', surface.outside, { path: [surface.outside, surface.container] });
    assert.equal(dismissed, 0, 'inside search/options and blur/body focus must not dismiss');
    surface.dispatch('pointerdown', surface.outside, { stopped: true });
    surface.dispatch('click', surface.outside, { stopped: true });
    surface.dispatch('focusin', surface.outside);
    assert.equal(dismissed, 3);
    await harness.render(Hook, { open: true, dismiss: () => { dismissed += 10; } });
    surface.dispatch('click', surface.outside);
    assert.equal(dismissed, 13, 'use the latest dismiss callback');
    await harness.render(Hook, { open: false });
    assert.equal(surface.count(), 0);
    await harness.render(Hook, { open: true, dismiss: () => dismissed++ });
    harness.cleanup();
    assert.equal(surface.count(), 0);
  } finally {
    harness.cleanup();
  }
});

const controls = [
  ['common select', '../frontend/common/components/CustomSelect.tsx', 'CustomSelect', {
    value: 'main', options: [{ value: 'main', label: 'main' }, { value: 'feature', label: 'feature' }], searchable: true,
    dropdownPlacement: 'top', dropdownListMaxHeight: '9rem',
  }, 'Search options…'],
  ['buffer font', '../frontend/features/preferences/components/tabs/PreferencesFontTab.tsx', 'PreferencesFontTab', {
    draftFontFamily: 'JetBrains Mono', draftFontSize: 13, draftLineSpacing: 1.5,
  }, 'Filter monospace fonts...'],
  ['branch select', '../frontend/features/git/components/BranchSelector.tsx', 'BranchSelector', {
    value: 'main', branches: { current: 'main', local: ['main', 'feature'], remote: [] },
  }, 'Filter branches...'],
  ['tab branch select', '../frontend/features/git/components/TabBranchSelector.tsx', 'TabBranchSelector', {
    value: 'main', roleType: 'source', branches: { current: 'main', local: ['main', 'feature'], remote: [] },
  }, 'Filter branches...'],
];

for (const [name, path, exported, initialProps, placeholder] of controls) {
  test(`${name} closes outside, keeps inside search open, and still selects normally`, async () => {
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    const surface = eventSurface();
    globalThis.document = surface.document;
    globalThis.window = surface.document;
    const harness = componentHarness();
    const selected = [];
    const props = { ...initialProps, onChange: (value) => selected.push(value),
      setDraftFontFamily: (value) => selected.push(value), setDraftEnableLigatures: (value) => selected.push(value) };
    const controls = loadWithMocks(new URL(path, import.meta.url), {
      react: harness.react,
      ...Object.fromEntries(['ChevronDown', 'Check', 'Search', 'GitBranch', 'Globe', 'Bold', 'Italic', 'Underline']
        .map((name) => [`@/common/components/icons/${name}`, { [name]: () => null }])),
      '../../store/usePreferencesStore': { checkFontLigaturesSupport: () => true },
    });
    const Component = controls[exported];
    const nodes = (tree) => componentNodes(tree);
    const search = (tree) => nodes(tree).find((node) => node.type === 'input' && node.props.placeholder === placeholder);
    try {
      let tree = await harness.render(Component, props);
      nodes(tree).find((node) => node.type === 'div' && node.props.ref).props.ref.current = surface.container;
      nodes(tree).find((node) => node.type === 'button').props.onClick();
      tree = await harness.render(Component, props);
      assert.ok(search(tree), 'opens');
      if (name === 'common select') {
        assert.match(nodes(tree).find((node) => node.props.className?.includes('bottom-full')).props.className, /\bbottom-full\b/,
          'upward placement keeps the font menu visible inside a scroll viewport');
        assert.equal(nodes(tree).find((node) => node.props.role === 'listbox').props.style.maxHeight, '9rem');
      }
      surface.dispatch('pointerdown', surface.inside);
      tree = await harness.render(Component, props);
      assert.ok(search(tree), 'inside interaction must not dismiss');
      search(tree).props.onChange({ target: { value: name === 'buffer font' ? 'Source Code Pro' : 'feature' } });
      tree = await harness.render(Component, props);
      surface.dispatch('click', surface.outside, { stopped: true });
      tree = await harness.render(Component, props);
      assert.equal(search(tree), undefined, 'outside click dismisses');
      assert.deepEqual(selected, [], 'dismissal does not change value');
      assert.equal(surface.count(), 0, 'close removes listeners');
      nodes(tree).find((node) => node.type === 'button').props.onClick();
      tree = await harness.render(Component, props);
      search(tree).props.onChange({ target: { value: name === 'buffer font' ? 'Source Code Pro' : 'feature' } });
      tree = await harness.render(Component, props);
      const option = name === 'common select'
        ? nodes(tree).find((node) => node.props.role === 'option')
        : nodes(tree).filter((node) => node.type === 'button')[1];
      option.props.onClick();
      tree = await harness.render(Component, props);
      assert.equal(search(tree), undefined);
      assert.deepEqual(selected, name === 'buffer font' ? ['Source Code Pro', false] : ['feature']);
    } finally {
      harness.cleanup();
      globalThis.document = originalDocument;
      globalThis.window = originalWindow;
    }
  });
}

test('MR reviewer/label pickers dismiss independently and preserve multi-selection and metadata refresh', async () => {
  const surface = eventSurface();
  const harness = componentHarness();
  const { useNewMrMetadata } = loadWithMocks(new URL('../frontend/features/virtual-mr/components/useNewMrMetadata.ts', import.meta.url), {
    react: harness.react,
  });
  const refreshed = [];
  const updates = [];
  let reloaded = 0;
  const props = {
    currentRepo: { id: 'repo' }, repoLabels: [], draftMr: { selectedBots: [], selectedLabels: [] },
    reloadPersistedReviewers: () => reloaded++,
    refreshRepoMetadata: async (id) => refreshed.push(id),
    updateDraftMr: (patch) => updates.push(patch),
  };
  try {
    let state = await harness.render(useNewMrMetadata, props);
    state.botDropdownRef.current = surface.container;
    const labelTarget = {};
    state.labelDropdownRef.current = { ownerDocument: surface.document, contains: (target) => target === labelTarget };
    await state.toggleReviewerDropdown();
    state = await harness.render(useNewMrMetadata, props);
    surface.dispatch('pointerdown', surface.inside);
    state.handleToggleBot('reviewer');
    state = await harness.render(useNewMrMetadata, props);
    assert.equal(state.showBotDropdown, true);
    surface.dispatch('pointerdown', labelTarget, { stopped: true });
    await state.toggleLabelDropdown();
    state = await harness.render(useNewMrMetadata, props);
    assert.equal(state.showBotDropdown, false);
    assert.equal(state.showLabelDropdown, true);
    surface.dispatch('click', labelTarget);
    state.handleToggleLabel('label');
    state = await harness.render(useNewMrMetadata, props);
    assert.equal(state.showLabelDropdown, true, 'multi-selection remains open');
    surface.dispatch('focusin', surface.outside);
    state = await harness.render(useNewMrMetadata, props);
    assert.equal(state.showLabelDropdown, false);
    assert.deepEqual(updates, [{ selectedBots: ['reviewer'] }, { selectedLabels: ['label'] }]);
    assert.deepEqual(refreshed, ['repo', 'repo']);
    assert.equal(reloaded, 1);
    assert.equal(surface.count(), 0);
  } finally {
    harness.cleanup();
  }
});
