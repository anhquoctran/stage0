import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const helpers = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/discussionCodeContext.ts', import.meta.url), {});
const diff = loadWithMocks(new URL('../frontend/features/git/utils/discussionDiff.ts', import.meta.url), {});

test('manual discussions preserve explicit diff format and side coordinates across unequal hunks', () => {
  const hunks = ['@@ -10,2 +20,3 @@\n keep\n-old\n+new\n+extra'];
  const left = diff.getDiffCodeSnippet(hunks, 'left', 11);
  const right = diff.getDiffCodeSnippet(hunks, 'right', 21);
  assert.equal(left.format, 'diff');
  assert.deepEqual(helpers.getDiscussionCodeRows({ diffSide: 'left', lineNumber: 11, codeSnippet: left }).map((row) => row.number), [10, 11]);
  assert.deepEqual(helpers.getDiscussionCodeRows({ diffSide: 'right', lineNumber: 21, codeSnippet: right }).map((row) => row.number), [20, 21, 22]);
});

test('single-side excerpts retain exact line numbers, source prefixes and the full selected range', () => {
  const discussion = {
    diffSide: 'right', lineNumber: 60,
    codeSnippet: { startLine: 58, selectedLine: 60, selectedEndLine: 61, format: 'diff', lines: [' context', '+added', '++literal', ' unchanged'] },
  };
  const rows = helpers.getDiscussionCodeRows(discussion);
  assert.deepEqual(rows.map((row) => [row.number, row.type, row.isSelected, row.text]), [
    [58, 'context', false, 'context'], [59, 'add', false, 'added'],
    [60, 'add', true, '+literal'], [61, 'context', true, 'unchanged'],
  ]);
  assert.equal(helpers.getDiscussionPosition(discussion).commentLabel, 'Comment on lines +60 to +61');
  assert.equal(helpers.getDiscussionPosition({ ...discussion, diffSide: 'left' }).commentLabel, 'Comment on lines −60 to −61');
});

test('plain excerpts preserve operators and indentation; older prefixed snippets retain their source side', () => {
  const plain = helpers.getDiscussionCodeRows({ lineNumber: 3, codeSnippet: { startLine: 2, format: 'plain', lines: ['  indented', '+value', '-value'] } });
  assert.deepEqual(plain.map((row) => row.text), ['  indented', '+value', '-value']);
  const legacy = helpers.getDiscussionCodeRows({ diffSide: 'left', lineNumber: 30, codeSnippet: { startLine: 29, lines: [' before', '-removed', ' after'] } });
  assert.deepEqual(legacy.map((row) => row.number), [29, 30, 31]);
  assert.equal(legacy[1].type, 'del');
});

test('discussion shows a readable path, signed range, snapshot and highlighted code before the comment', async () => {
  const harness = componentHarness();
  const { DiscussionCodeContext } = loadWithMocks(new URL('../frontend/features/virtual-mr/components/DiscussionCodeContext.tsx', import.meta.url), {
    react: harness.react,
    '../../../common/components/icons/Copy': { Copy: 'Copy' },
    '../../../common/components/icons/Check': { Check: 'Check' },
    '../../git/store/useGitStore': { useGitStore: () => ({ showToast() {} }) },
  });
  const path = 'src/deeply/nested/catalog-service.ts';
  const nodes = componentNodes(await harness.render(DiscussionCodeContext, { discussion: {
    filePath: path, diffSide: 'right', lineNumber: 60, commitId: 'c419ba81abcdef',
    codeSnippet: { startLine: 59, selectedLine: 60, selectedEndLine: 61, format: 'diff', lines: [' before', '+cursor predicate', '+tie breaker', ' after'] },
  } }));
  const text = nodes.flatMap((node) => node.props?.children ?? []).flat(Infinity).filter((item) => typeof item === 'string').join(' ');
  assert.ok(text.includes(path));
  assert.ok(text.includes('Comment on lines +60 to +61'));
  assert.ok(text.includes('c419ba81'));
  assert.ok(text.includes('cursor predicate'));
  const file = nodes.find((node) => node.props?.children?.includes(path));
  assert.match(file.props.className, /break-all/);
  assert.doesNotMatch(file.props.className, /truncate/);
  const issueRows = nodes.filter((node) => node.type === 'tr' && node.props['data-selected']);
  assert.deepEqual(issueRows.map((node) => node.props['data-line-number']), [60, 61]);
  assert.ok(issueRows.every((node) => node.props.className.includes('bg-emerald-600 text-white')));
  harness.cleanup();
});
