import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const { getDiscussionCommentBody } = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/discussionCommentBody.ts', import.meta.url), {});
const { buildDiscussionQuote } = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/discussionReferences.ts', import.meta.url), {});
const runId = '0abafec1-5a8b-47b3-97c2-0b5684148bc5';
const discussionId = `review-${runId}-0`;
const content = '**[medium] Finding**\n\nExplanation\n\nSuggested fix:\n```ts\nreturn quote(product);\n```';
const evidence = '\n\nEvidence from `d09561f37538a80bb9abe0908a348a47ce630214` lines 16–16:\n\n```\n...product,\n```';
const footer = `\n\nReview run \`${runId}\` · acp · Codex. This is a model finding, not an approval.`;
const comment = { id: `${discussionId}-comment`, discussionId, authorType: 'ai_agent', authorName: 'Code Reviewer', body: content + evidence + footer };

test('legacy metadata and duplicate evidence are hidden while explanation, suggested code and stored body remain intact', () => {
  assert.equal(getDiscussionCommentBody(comment), content);
  assert.equal(comment.body, content + evidence + footer);
  assert.equal(getDiscussionCommentBody({ ...comment, body: content }), content);
  assert.equal(getDiscussionCommentBody({ ...comment, body: content + evidence }), content);
  assert.equal(getDiscussionCommentBody({ ...comment, body: content + footer }), content);
});

test('user comments, replies, unrelated run IDs and text after a footer remain untouched', () => {
  for (const original of [
    { ...comment, authorType: 'user' },
    { ...comment, id: 'reply-id' },
    { ...comment, discussionId: 'manual-thread', id: 'manual-thread-comment' },
    { ...comment, body: comment.body.replace(runId, 'another-run') },
    { ...comment, body: `${comment.body}\n\nUser-added explanation` },
  ]) assert.equal(getDiscussionCommentBody(original), original.body);
});

test('quoting an older AI finding does not bring its hidden footer back into a reply', () => {
  const quote = buildDiscussionQuote({ id: discussionId, rootComment: comment });
  assert.ok(quote.includes('Explanation'));
  assert.ok(quote.includes('Suggested fix'));
  assert.ok(!quote.includes('Evidence from'));
  assert.ok(!quote.includes('...product,'));
  assert.ok(!quote.includes('Review run'));
  assert.ok(!quote.includes('not an approval'));
});
