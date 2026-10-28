import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const { resolveLocalAuthor } = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/localAuthorIdentity.ts', import.meta.url), {});
const { fromDbDiscussion } = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/fromDbDiscussion.ts', import.meta.url), {});
const current = { name: 'git-account', email: 'alice@example.test' };

test('local placeholders resolve to Git identity or the email username without changing named authors', () => {
  assert.deepEqual(resolveLocalAuthor('Local User', 'user@local.stage0', current), current);
  assert.deepEqual(resolveLocalAuthor('', 'alice@example.test'), { name: 'alice', email: 'alice@example.test' });
  assert.deepEqual(resolveLocalAuthor('Bob', 'bob@example.test', current), { name: 'Bob', email: 'bob@example.test' });
  assert.deepEqual(resolveLocalAuthor('Local User', 'bob@example.test', current), { name: 'bob', email: 'bob@example.test' });
  assert.equal(resolveLocalAuthor().name, 'Local User');
});

test('old local comments show the Git identity on load while AI bot identities remain intact', () => {
  const old = { id: 'human', author_type: 'user', author_name: 'Local User', author_id: 'user@local.stage0', body: 'Original comment' };
  const bot = { id: 'bot', author_type: 'ai_agent', author_name: 'Code Reviewer', author_id: 'bot-id', body: 'Finding' };
  const discussion = fromDbDiscussion({ id: 'thread', comments: [old, bot] }, current);
  assert.equal(discussion.rootComment.authorName, 'git-account');
  assert.equal(discussion.rootComment.authorId, 'alice@example.test');
  assert.equal(discussion.rootComment.body, old.body);
  assert.equal(discussion.children[0].authorName, bot.author_name);
  assert.equal(discussion.children[0].authorId, bot.author_id);
  assert.equal(old.author_name, 'Local User', 'stored records are not rewritten');
});

test('Bot badge appears next to AI authors and is absent for human authors', async () => {
  const harness = componentHarness();
  const { DiscussionThreadHeader } = loadWithMocks(new URL('../frontend/features/virtual-mr/components/discussion/DiscussionThreadHeader.tsx', import.meta.url), {
    react: harness.react,
    '../GitLabAvatar': { GitLabAvatar: () => null },
    '../AiBotBadge': { AiBotBadge: () => harness.react.createElement('span', { 'aria-label': 'AI bot' }, 'Bot') },
    '../../../../common/components/icons/Quote': { Quote: () => null },
  });
  try {
    for (const authorType of ['ai_agent', 'user']) {
      const nodes = componentNodes(await harness.render(DiscussionThreadHeader, {
        rootAuthorName: 'Reviewer', rootAuthorHandle: '@reviewer',
        rootComment: { authorType }, discussion: { id: 'thread' }, quote() {},
      }));
      assert.equal(nodes.some(node => node.props['aria-label'] === 'AI bot'), authorType === 'ai_agent');
    }
  } finally { harness.cleanup(); }
});
