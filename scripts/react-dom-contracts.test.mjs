import assert from 'node:assert/strict';
import React, { act } from 'react';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadWithMocks } from './helpers/componentHarness.mjs';

test('real React portal search receives focus only after the popup becomes visible', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://stage0.test/' });
  const keys = ['window', 'document', 'HTMLElement', 'Element', 'Node', 'IS_REACT_ACT_ENVIRONMENT'];
  const descriptors = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of keys) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : key === 'window' ? dom.window : key === 'document' ? dom.window.document : dom.window[key] });
  dom.window.Element.prototype.scrollIntoView = () => {};
  // JSDOM has no layout. Match the browser's refusal to focus visibility:hidden
  // descendants; the production React, hooks, renderer and portal stay real.
  const focus = dom.window.HTMLElement.prototype.focus;
  dom.window.HTMLElement.prototype.focus = function (...args) {
    for (let ancestor = this; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.style.visibility === 'hidden') return;
    }
    return focus.apply(this, args);
  };
  let root;
  try {
    const { createRoot } = await import('react-dom/client');
    const { createPortal } = await import('react-dom');
    const { CustomSelect } = loadWithMocks(new URL('../frontend/common/components/CustomSelect.tsx', import.meta.url), { react: { ...React, default: React }, 'react-dom': { createPortal },
      './icons/ChevronDown': { ChevronDown: () => null }, './icons/Check': { Check: () => null } });
    root = createRoot(dom.window.document.getElementById('root'));
    await act(async () => root.render(React.createElement(CustomSelect, { value: 'auto', onChange() {}, searchable: true, portal: true,
      options: [{ value: 'auto', label: 'Automatic' }, { value: 'utf8', label: 'UTF-8' }] })));
    const trigger = dom.window.document.querySelector('button');
    await act(async () => trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
    const search = dom.window.document.querySelector('input[type="search"]');
    assert.ok(search, 'Search input is rendered through the actual React portal');
    assert.ok(dom.window.document.activeElement === search, 'Search must receive focus after the portalled menu is visible');
    assert.equal(dom.window.document.getElementById('root').contains(search), false);
    await act(async () => root.unmount()); root = undefined;
    assert.equal(dom.window.document.querySelector('[role="listbox"]'), null);
  } finally {
    if (root) await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
