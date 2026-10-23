import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

  // Window title should also include the version when no repository is open
  assert.match(topBarSrc, /Stage0 v\$\{about\.packageVersion\} — Virtual MR Sandbox/);
});
