import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const { discussionReplyRecipients } = loadWithMocks(
  new URL('../frontend/features/review/utils/discussionReplyRecipients.ts', import.meta.url), {},
);
const mention = '[@Tester](#mr-mention/reviewer/b)';
const sha = 'c419ba81fd4c7b10956388297e4b8728b0f910df';
const comment = (authorType, authorId, body) => ({ authorType, authorId, body });
const thread = (rootComment, children = []) => ({ id: 'thread', isResolved: false, rootComment, children });

test('human discussions and entity references never select an unsolicited reviewer', () => {
  for (const body of ['!1', sha, 'A question for the team',
    '[@!1](#mr-mention/mr/mr-1)', `[@${sha.slice(0, 7)}](#mr-mention/commit/${sha})`,
    '[@Alice](#mr-mention/assignee/alice)', `> ${mention}`, `\`${mention}\``]) {
    assert.deepEqual(discussionReplyRecipients(thread(comment('user', 'alice', body)), ['a', 'b']), [], body);
  }
  // A human with the same ID as a reviewer is still a human.
  assert.deepEqual(discussionReplyRecipients(thread(comment('user', 'b', '!1')), ['a', 'b']), []);
});

test('only a direct reviewer mention opts a human discussion into a bot reply', () => {
  const discussion = thread(comment('user', 'alice', `${mention} please explain`));
  assert.deepEqual(discussionReplyRecipients(discussion, ['a', 'b']), ['b']);
  discussion.children.push(comment('ai_agent', 'b', 'Here is the answer'));
  discussion.children.push(comment('user', 'alice', sha));
  assert.deepEqual(discussionReplyRecipients(discussion, ['a', 'b']), []);
  discussion.children.push(comment('user', 'alice', `${mention} another question`));
  assert.deepEqual(discussionReplyRecipients(discussion, ['a', 'b']), ['b']);
});

test('unmentioned followups belong only to the assigned bot that started the finding', () => {
  const discussion = thread(comment('ai_agent', 'b', 'Finding'), [comment('user', 'alice', 'Why?')]);
  assert.deepEqual(discussionReplyRecipients(discussion, ['a', 'b']), ['b']);
  assert.deepEqual(discussionReplyRecipients(discussion, ['a']), []);
  discussion.isResolved = true;
  assert.deepEqual(discussionReplyRecipients(discussion, ['a', 'b']), []);
});

test('missing roots cannot transfer ownership to an arbitrary reply or first assigned bot', () => {
  assert.deepEqual(discussionReplyRecipients(thread(null, [comment('user', 'alice', '!1')]), ['a', 'b']), []);
  assert.deepEqual(discussionReplyRecipients(thread(null, [comment('ai_agent', 'b', 'Old answer'),
    comment('user', 'alice', sha)]), ['a', 'b']), []);
});

test('the automatic queue starts no API run for human chatter and routes intentional replies only', async () => {
  for (const [root, children, expected] of [
    [comment('user', 'alice', '!1'), [], []],
    [comment('user', 'alice', '!1'), [comment('user', 'alice', sha)], []],
    [comment('user', 'alice', '!1'), [comment('ai_agent', 'b', 'Old unsolicited answer'),
      comment('user', 'alice', sha)], []],
    [comment('user', 'alice', `${mention} explain`), [], ['b']],
    [comment('ai_agent', 'b', 'Finding'), [comment('user', 'alice', 'Why?')], ['b']],
  ]) {
    const discussion = thread(root, children);
    const profiles = ['a', 'b'].map((id) => ({ id, name: id }));
    const session = { id: 'mr', status: 'open', repoId: 'repo', discussions: [discussion],
      reviewers: profiles.map(({ id, name }) => ({ agentId: id, agentName: name })) };
    const starts = [], warnings = [];
    const finished = { id: 'run', sessionId: 'mr', status: 'completed' };
    const { queueAssignedDiscussionReply } = loadWithMocks(
      new URL('../frontend/features/review/services/assignedReviewService.ts', import.meta.url), {
        '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({
          reviews: { getAiReview: async () => ({ run: finished }) },
        }) },
        '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: { getState: () => ({ sessions: [session] }) } },
        '../../ai/store/useBotReviewersStore': { useBotReviewersStore: { getState: () => ({ globalReviewers: profiles, repoCustomReviewers: {} }) } },
        '../../ai/store/useAiMcpStore': { useAiMcpStore: { getState: () => ({ dynamicModels: [], externalAgents: [] }) } },
        '../utils/resolveReviewBotConfig': { resolveReviewBotConfig: () => ({ provider: 'ollama' }) },
        '../../ai/utils/providerModelCatalog': { getProviderModelCatalog: () => [] },
        '../utils/discussionReplyVersion': { discussionReplyVersion: async () => 'version' },
        '../store/useReviewStore': { isReviewStartingForSession: () => false, useReviewStore: { getState: () => ({
          activeRuns: {}, reviewBatches: {}, syncRun: async () => {},
          startForSession: async (_id, _config, _remote, reviewer, description, discussionId) => {
            starts.push(reviewer.id);
            assert.equal(description, false);
            assert.equal(discussionId, discussion.id);
            discussion.children.push(comment('ai_agent', reviewer.id, 'Answer'));
            return finished;
          },
        }) } },
        '../../git/store/useGitStore': { useGitStore: { getState: () => ({ showToast: (...args) => warnings.push(args) }) } },
        '../../notifications/services/notificationService': { notificationService: { notify: async () => {} } },
      },
    );
    await queueAssignedDiscussionReply('mr', 'thread');
    assert.deepEqual(warnings, []);
    assert.deepEqual(starts, expected);
  }
});
