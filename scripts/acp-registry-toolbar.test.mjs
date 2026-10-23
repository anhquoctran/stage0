import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('AcpRegistryToolbar renders seamless segmented control without jagged corner notches', () => {
  const toolbarSrc = readFileSync(
    new URL('../frontend/features/ai/components/external-agents/AcpRegistryToolbar.tsx', import.meta.url),
    'utf-8'
  );

  // Outer segmented control should have padding and rounded-sm to frame inner buttons cleanly
  assert.match(toolbarSrc, /border border-surface1 bg-crust p-0\.5 rounded-sm/);

  // Inner buttons should have padding and rounded-sm without nested right borders
  assert.match(toolbarSrc, /px-3 py-1 rounded-sm transition-colors cursor-pointer font-medium/);
  assert.doesNotMatch(toolbarSrc, /border-r border-surface1 px-3 py-1\.5 last:border-r-0/);

  // Search input wrapper should also be rounded-sm
  assert.match(toolbarSrc, /<label className="[^"]*rounded-sm/);
});
