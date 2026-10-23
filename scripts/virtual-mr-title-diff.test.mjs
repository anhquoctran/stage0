import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const { computeTitleDiff } = loadWithMocks(
  new URL('../frontend/features/virtual-mr/utils/virtualMrTitleDiff.ts', import.meta.url),
  {}
);

test('computeTitleDiff isolates changed part when common prefix exists (user case)', () => {
  const oldTitle = 'Draft: fix(profile): sync display names across realtime chat';
  const newTitle = 'Draft: [BUG]: ID_18836';

  const diff = computeTitleDiff(oldTitle, newTitle);
  assert.equal(diff.prefix, 'Draft: ');
  assert.equal(diff.oldDiff, 'fix(profile): sync display names across realtime chat');
  assert.equal(diff.newDiff, '[BUG]: ID_18836');
  assert.equal(diff.suffix, '');
});

test('computeTitleDiff handles common prefix and suffix', () => {
  const oldTitle = '[FE] Fix login button padding in navbar';
  const newTitle = '[FE] Fix login button margin in navbar';

  const diff = computeTitleDiff(oldTitle, newTitle);
  assert.equal(diff.prefix, '[FE] Fix login button ');
  assert.equal(diff.oldDiff, 'padding');
  assert.equal(diff.newDiff, 'margin');
  assert.equal(diff.suffix, ' in navbar');
});

test('computeTitleDiff handles prefix addition (e.g. marking Draft)', () => {
  const oldTitle = 'Fix button style';
  const newTitle = 'Draft: Fix button style';

  const diff = computeTitleDiff(oldTitle, newTitle);
  assert.equal(diff.prefix, '');
  assert.equal(diff.oldDiff, '');
  assert.equal(diff.newDiff, 'Draft: ');
  assert.equal(diff.suffix, 'Fix button style');
});

test('computeTitleDiff handles complete replacement (no common prefix/suffix)', () => {
  const oldTitle = 'Initial commit';
  const newTitle = 'Release v1.0.0';

  const diff = computeTitleDiff(oldTitle, newTitle);
  assert.equal(diff.prefix, '');
  assert.equal(diff.oldDiff, 'Initial commit');
  assert.equal(diff.newDiff, 'Release v1.0.0');
  assert.equal(diff.suffix, '');
});

test('computeTitleDiff handles identical strings gracefully', () => {
  const title = 'Identical Title';
  const diff = computeTitleDiff(title, title);
  assert.equal(diff.prefix, 'Identical Title');
  assert.equal(diff.oldDiff, '');
  assert.equal(diff.newDiff, '');
  assert.equal(diff.suffix, '');
});

test('computeTitleDiff handles null or empty inputs safely', () => {
  const diff1 = computeTitleDiff('', 'New');
  assert.equal(diff1.prefix, '');
  assert.equal(diff1.oldDiff, '');
  assert.equal(diff1.newDiff, 'New');
  assert.equal(diff1.suffix, '');

  const diff2 = computeTitleDiff('Old', '');
  assert.equal(diff2.prefix, '');
  assert.equal(diff2.oldDiff, 'Old');
  assert.equal(diff2.newDiff, '');
  assert.equal(diff2.suffix, '');
});

