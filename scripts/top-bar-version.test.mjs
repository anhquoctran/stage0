import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { clsx } from 'clsx';
import { loadWithMocks } from './helpers/componentHarness.mjs';

function titleRowFixture({ currentRepo = null, version = '0.1.11' } = {}) {
  const calls = [];
  const menus = [];
  const { TopBarTitleRow } = loadWithMocks(
    new URL('../frontend/core/components/layout/top-bar/TopBarTitleRow.tsx', import.meta.url),
    {
      react: { ...React, default: React },
      clsx: { clsx },
      '@tauri-apps/api/core': { invoke: async (...args) => { calls.push(args); } },
      '../../../../common/components/AppLogo': { AppLogo: () => null },
      '../MenuBar': { MenuBar: (props) => { menus.push(props); return null; } },
      '../WindowControls': {
        WindowControls: () => React.createElement('div', { 'data-window-controls': 'windows' }),
      },
      '../../../../features/git/store/useGitStore': {
        useGitStore: () => ({ currentRepo, baseBranch: 'main', compareBranch: 'feature/titlebar' }),
      },
      '../../../../features/about/hooks/useAboutInfo': {
        useAboutInfo: () => ({ packageVersion: version }),
      },
    },
  );
  return { TopBarTitleRow, calls, menus };
}

test('TopBarTitleRow renders current application version as normal text next to Stage0 brand', () => {
  const topBarSrc = readFileSync(
    new URL('../frontend/core/components/layout/top-bar/TopBarTitleRow.tsx', import.meta.url),
    'utf-8'
  );

  // Must import and call useAboutInfo
  assert.match(topBarSrc, /useAboutInfo/);
  assert.match(topBarSrc, /const about = useAboutInfo\(\)/);

  // Must display version as normal text right alongside Stage0 (no badge background or borders)
  assert.match(topBarSrc, /Stage0<\/span>/);
  assert.match(topBarSrc, /v\{about\.packageVersion\}/);
  assert.match(topBarSrc, /text-\[10px\] font-mono text-subtext0/);
  assert.doesNotMatch(topBarSrc, /bg-surface0 text-subtext0 border/);

  // Full welcome-title metadata retains the version, separate from the visible title.
  assert.match(topBarSrc, /Stage0 v\$\{about\.packageVersion\} — Virtual MR Sandbox/);
});

for (const isMac of [true, false]) {
  for (const currentRepo of [null, { name: 'Stage0 repository' }]) {
    test(`${isMac ? 'macOS' : 'Windows/Linux'} shows one version ${currentRepo ? 'with a repository' : 'on welcome'}`, () => {
      const { TopBarTitleRow, menus } = titleRowFixture({ currentRepo });
      const html = renderToStaticMarkup(React.createElement(TopBarTitleRow, { isMac }));
      assert.equal((html.match(/>v0\.1\.11<\/span>/g) ?? []).length, 1);
      assert.match(html, /aria-label="Stage0 version 0\.1\.11"/);
      assert.match(html, /title="Stage0 v0\.1\.11"/);
      assert.match(html, /rounded-none/);
      assert.equal(menus.length, 1);
      assert.equal(Boolean(menus[0].hidden), isMac);
      if (isMac) {
        assert.match(html, /grid-cols-\[5rem_minmax\(0,1fr\)_5rem\]/);
        assert.match(html, /aria-hidden="true" class="w-20 h-full shrink-0"/);
        assert.doesNotMatch(html, /data-window-controls/);
      } else {
        assert.match(html, /Stage0<\/span><span[^>]*>v0\.1\.11<\/span>/);
        assert.match(html, /data-window-controls="windows"/);
      }
      if (currentRepo) {
        assert.match(html, />Stage0 repository — \[feature\/titlebar → main\]<\/span>/);
      } else {
        assert.match(html, />Stage0 — Virtual MR Sandbox<\/span>/);
        assert.match(html, /title="Stage0 v0\.1\.11 — Virtual MR Sandbox"/);
        assert.doesNotMatch(html, />Stage0 v0\.1\.11 — Virtual MR Sandbox<\/span>/);
      }
    });
  }
}

test('macOS constrains long versions while retaining the full tooltip and drag behavior', () => {
  const version = '12.34.56-beta.123+abcdef123456';
  const { TopBarTitleRow, calls } = titleRowFixture({ version });
  const tree = TopBarTitleRow({ isMac: true });
  const html = renderToStaticMarkup(tree);
  assert.ok(html.includes(`title="Stage0 v${version}"`));
  assert.match(html, /data-tauri-drag-region="true" title="Stage0 v[^"]+"[^>]+class="[^"]*truncate min-w-0"/);
  tree.props.onDoubleClick({ target: { closest: () => null } });
  assert.deepEqual(calls, [['window_toggle_maximize']]);
  tree.props.onDoubleClick({ target: { closest: () => ({}) } });
  assert.equal(calls.length, 1, 'interactive controls must not toggle maximize');
});
