import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const { getDiscussionEntityOptions } = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/discussionEntityMentions.ts', import.meta.url), {});
const { formatMention, parseMentionReference } = loadWithMocks(new URL('../frontend/common/utils/mentions.ts', import.meta.url), {});
const hash = 'c419ba81fd4c7b10956388297e4b8728b0f910df';
const session = { id: 'vmr-1793123456789', repoId: 'repo', title: 'Fix catalog cursors',
  commits: [{ hash, subject: 'fix: reject invalid cursors' }] };

test('MR references include the complete title and #ID for both dedicated and legacy pickers', () => {
  const [mr] = getDiscussionEntityOptions(session, []);
  for (const trigger of ['!', undefined]) {
    const markdown = formatMention(mr, trigger);
    assert.equal(markdown, `[Fix catalog cursors #${session.id}](#mr-mention/mr/${session.id})`);
    assert.deepEqual(parseMentionReference(/\]\(([^)]+)\)$/.exec(markdown)[1]), { kind: 'mr', id: session.id });
  }
});

test('commit references include the message and partial digest while linking the full hash', () => {
  const commit = getDiscussionEntityOptions(session, []).find(item => item.kind === 'commit');
  for (const trigger of ['#', undefined]) {
    assert.equal(formatMention(commit, trigger), `[fix: reject invalid cursors (c419ba81)](#mr-mention/commit/${hash})`);
  }
});

test('reference titles and messages stay escaped text rather than injecting Markdown or HTML', () => {
  const options = getDiscussionEntityOptions({ ...session, title: '[unsafe](javascript:alert) <img>\nTitle',
    commits: [{ hash, subject: '[message] <script>\nnext line' }] }, []);
  for (const option of options) {
    const markdown = formatMention(option, option.kind === 'mr' ? '!' : '#');
    assert.ok(markdown.includes('\\['));
    assert.ok(markdown.includes('\\<'));
    assert.equal(markdown.includes('\n'), false);
    assert.deepEqual(parseMentionReference(/\]\(([^)]+)\)$/.exec(markdown)[1]), { kind: option.kind, id: option.id });
  }
  assert.equal(formatMention({ kind: 'reviewer', id: 'bot', label: 'Tester' }), '[@Tester](#mr-mention/reviewer/bot)');
});
