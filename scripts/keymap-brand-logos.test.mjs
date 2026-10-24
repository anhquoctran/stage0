import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const assets = {
  vscode: 'vscode.svg', jetbrains: 'intellij-idea.svg', 'github-desktop': 'github-desktop.png',
  fork: 'fork.png', sourcetree: 'sourcetree.png', gitkraken: 'gitkraken.svg',
};
const mocks = Object.fromEntries(Object.values(assets).map((file) => [
  `../assets/keymap-logos/${file}`, { default: `/bundled/${file}` },
]));
const { KEYMAP_PRESET_LOGOS } = loadWithMocks(
  new URL('../frontend/features/preferences/constants/keymapPresetLogos.ts', import.meta.url), mocks,
);
const { KeymapPresetLogo } = loadWithMocks(
  new URL('../frontend/features/preferences/components/keymaps/KeymapPresetLogo.tsx', import.meta.url),
  { react: { ...React, default: React },
    '../../constants/keymapPresetLogos': { KEYMAP_PRESET_LOGOS },
    '../../../../common/components/AppLogo': { AppLogo: () => React.createElement('span', { 'data-stage0-logo': true }) } },
);

test('every external preset has its own bundled brand asset, with no remote runtime URLs', () => {
  assert.deepEqual(Object.keys(KEYMAP_PRESET_LOGOS).sort(), Object.keys(assets).sort());
  assert.equal(new Set(Object.values(KEYMAP_PRESET_LOGOS)).size, 6);
  for (const [preset, file] of Object.entries(assets)) {
    assert.equal(KEYMAP_PRESET_LOGOS[preset], `/bundled/${file}`);
    const bytes = readFileSync(new URL(`../frontend/features/preferences/assets/keymap-logos/${file}`, import.meta.url));
    if (file.endsWith('.png')) assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    else {
      const svg = bytes.toString('utf8');
      assert.match(svg, /<svg\b/);
      assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\son\w+=|(?:href|src)=["'](?:https?:|javascript:)/i);
      assert.match(svg, /#[\da-f]{6}/i, 'Retain the original artwork colors');
    }
    const html = renderToStaticMarkup(React.createElement(KeymapPresetLogo, { preset }));
    assert.ok(html.includes(`src="/bundled/${file}"`));
    assert.match(html, /alt=""/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /width="24" height="24"/);
    assert.match(html, /object-contain/);
    assert.doesNotMatch(html, /filter|invert|grayscale|text-mauve/);
  }
});

test('Stage0 reuses the application logo, not another brand or the generic branch icon', () => {
  const html = renderToStaticMarkup(React.createElement(KeymapPresetLogo, { preset: 'stage0' }));
  assert.match(html, /data-stage0-logo="true"/);
  assert.doesNotMatch(html, /<img/);
});
