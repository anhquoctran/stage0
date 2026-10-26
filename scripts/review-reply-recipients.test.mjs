import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const { directReviewerMentions, discussionReplyRecipients } = loadWithMocks(
  new URL('../frontend/features/review/utils/discussionReplyRecipients.ts', import.meta.url), {},
);
const mention = '[@Bot B](#mr-mention/reviewer/b)';

test('discussion addressing ignores quoted, escaped and code mentions', () => {
  for (const body of [`> ${mention}`, `\`${mention}\``, `\`\`\`md\n${mention}\n\`\`\``, `~~~\n${mention}\n~~~`, `\\${mention}`, `    ${mention}`, `!${mention}`]) {
    assert.deepEqual(directReviewerMentions(body, ['a', 'b']), []);
  }
  assert.deepEqual(directReviewerMentions(`Please check ${mention}`, ['a', 'b']), ['b']);
  assert.deepEqual(directReviewerMentions('[@Bot](#mr-mention/reviewer/bogus)', ['b']), []);
});

test('user followups prefer the original reviewer while peer comments require a direct mention', () => {
  const thread = { isResolved: false, rootComment: { id: 'root', authorType: 'ai_agent', authorId: 'b', body: 'Finding' },
    children: [{ id: 'reply', authorType: 'user', authorId: 'alice', body: 'Explain this finding' }] };
  assert.deepEqual(discussionReplyRecipients(thread, ['a', 'b']), ['b']);
  thread.children[0].body = '[@A](#mr-mention/reviewer/a) please check';
  assert.deepEqual(discussionReplyRecipients(thread, ['a', 'b']), ['a']);
  thread.children[0] = { id: 'peer', authorType: 'ai_agent', authorId: 'a', body: mention };
  assert.deepEqual(discussionReplyRecipients(thread, ['a', 'b']), ['b']);
  thread.children[0].authorId = 'b';
  assert.deepEqual(discussionReplyRecipients(thread, ['a', 'b']), []);
  thread.isResolved = true;
  assert.deepEqual(discussionReplyRecipients(thread, ['a', 'b']), []);
});
