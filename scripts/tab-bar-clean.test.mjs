import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('TabBar does not render "No open MR tabs" placeholder', () => {
  const tabBarSrc = readFileSync(
    new URL('../frontend/core/components/layout/TabBar.tsx', import.meta.url),
    'utf-8'
  );

  assert.doesNotMatch(
    tabBarSrc,
    /No open MR tabs/,
    'TabBar should not contain the "No open MR tabs" placeholder text'
  );
});

