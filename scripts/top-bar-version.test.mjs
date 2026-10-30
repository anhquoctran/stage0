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
  const controls = [];
  const { TopBarTitleRow } = loadWithMocks(
    new URL('../frontend/core/components/layout/top-bar/TopBarTitleRow.tsx', import.meta.url),
    {
      react: { ...React, default: React },
      clsx: { clsx },
      '@tauri-apps/api/core': { invoke: async (...args) => { calls.push(args); } },
      '../../../../common/components/AppLogo': { AppLogo: () => null },
      '../MenuBar': { MenuBar: (props) => { menus.push(props); return null; } },
      '../WindowControls': {
        WindowControls: (props) => {
          controls.push(props);
          return React.createElement('div', {
            'data-window-controls': props.style,
            className: props.className,
          });
        },
      },
      '../../../../features/git/store/useGitStore': {
        useGitStore: () => ({ currentRepo, baseBranch: 'main', compareBranch: 'feature/titlebar' }),
      },
      '../../../../features/about/hooks/useAboutInfo': {
        useAboutInfo: () => ({ packageVersion: version }),
      },
    },
  );
  return { TopBarTitleRow, calls, menus, controls };
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
  assert.match(topBarSrc, /`Stage0 v\$\{about\.packageVersion\} — \$\{t\('common\.layout\.productDescriptor'\)\}`/);
});

for (const isMac of [true, false]) {
  for (const currentRepo of [null, { name: 'Stage0 repository' }]) {
    test(`${isMac ? 'macOS' : 'Windows/Linux'} shows one version ${currentRepo ? 'with a repository' : 'on welcome'}`, () => {
      const { TopBarTitleRow, menus, controls } = titleRowFixture({ currentRepo });
      const html = renderToStaticMarkup(React.createElement(TopBarTitleRow, { isMac }));
      assert.equal((html.match(/>v0\.1\.11<\/span>/g) ?? []).length, 1);
      assert.match(html, /aria-label="Stage0 version 0\.1\.11"/);
      assert.match(html, /title="Stage0 v0\.1\.11"/);
      assert.match(html, /rounded-none/);
      assert.match(html, /<div dir="ltr"/);
      assert.equal(menus.length, 1);
      assert.equal(Boolean(menus[0].hidden), isMac);
      if (isMac) {
        assert.match(html, /grid-cols-\[5rem_minmax\(0,1fr\)_5rem\]/);
        assert.match(html, /data-window-controls="mac"/);
        assert.equal(controls[0].style, 'mac');
        assert.match(controls[0].className, /-translate-x-4/);
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

test('macOS constrains long versions and leaves double-click handling with the native drag owner', () => {
  const version = '12.34.56-beta.123+abcdef123456';
  const { TopBarTitleRow, calls } = titleRowFixture({ version });
  let tree;
  function Probe() { tree = TopBarTitleRow({ isMac: true }); return tree; }
  const html = renderToStaticMarkup(React.createElement(Probe));
  assert.ok(html.includes(`title="Stage0 v${version}"`));
  assert.match(html, /title="Stage0 v[^"]+" aria-label="Stage0 version [^"]+" class="[^"]*truncate min-w-0"/);
  assert.equal(tree.props['data-tauri-drag-region'], true);
  assert.equal(tree.props.onDoubleClick, undefined, 'framework drag handling already owns double-click');
  assert.equal(typeof tree.props.onMouseDown, 'function');
  assert.deepEqual(calls, [], 'React must not issue another maximize request');
});
