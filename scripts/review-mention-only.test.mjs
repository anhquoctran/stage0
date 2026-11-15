import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { loadWithMocks } from './helpers/componentHarness.mjs';
const { create } = createRequire(import.meta.url)('zustand');

function fixture(body) {
  const discussion = { id: 'thread', isResolved: false,
    rootComment: { authorType: 'ai_agent', authorId: 'b', body: 'Finding' },
    children: [{ id: 'user', authorType: 'user', authorId: 'alice', body }] };
  const profiles = ['a', 'b'].map(id => ({ id, name: id }));
  const session = { id: 'mr', repoId: 'repo', status: 'open', discussions: [discussion],
    reviewers: profiles.map(({id,name}) => ({agentId:id, agentName:name})) };
  const starts = [], warnings = [];
  const run = { id: 'run', sessionId: 'mr', status: 'completed', published: false,
    reviewerId: 'b', replyDiscussionId: 'thread' };
  const virtualMrStore = { getState: () => ({ sessions: [session], refreshDiscussions: async () => {} }) };
  const runtime = { getApplicationServices: () => ({ reviews: {
    startAiReview: async ({request}) => { starts.push(request.reviewerId); return run; },
    getAiReview: async () => ({ run, events: [] }),
  } }) };
  const reviewStore = loadWithMocks(new URL('../frontend/features/review/store/useReviewStore.ts', import.meta.url), {
    zustand: { create },
    '../../../core/services/runtime/applicationRuntime': runtime,
    '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: virtualMrStore },
    '../services/assignedReviewService': { flushQueuedReReviewAfterActive: async () => {} },
  });
  const { queueAssignedDiscussionReply } = loadWithMocks(
    new URL('../frontend/features/review/services/assignedReviewService.ts', import.meta.url), {
      '../../../core/services/runtime/applicationRuntime': runtime,
      '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: virtualMrStore },
      '../../ai/store/useBotReviewersStore': { useBotReviewersStore: { getState: () => ({ globalReviewers: profiles, repoCustomReviewers: {} }) } },
      '../../ai/store/useAiMcpStore': { useAiMcpStore: { getState: () => ({ dynamicModels: [], externalAgents: [] }) } },
      '../utils/resolveReviewBotConfig': { resolveReviewBotConfig: () => ({ provider: 'ollama' }) },
      '../../ai/utils/providerModelCatalog': { getProviderModelCatalog: () => [] },
      '../utils/discussionReplyVersion': { discussionReplyVersion: async comment => `${comment.id}:${comment.body}` },
      '../store/useReviewStore': reviewStore,
      '../../git/store/useGitStore': { useGitStore: { getState: () => ({ showToast: (...args) => warnings.push(args) }) } },
      '../../notifications/services/notificationService': { notificationService: { notify: async () => {} } },
    },
  );
  return { queue: () => queueAssignedDiscussionReply('mr', 'thread'), starts, warnings, discussion };
}

test('own-finding followups, quoted mentions and entity references never start an unmentioned reviewer', async () => {
  for (const body of ['Why?', 'Please explain this finding', '!mr-123', '#c419ba8',
    '[@B](#mr-mention/reviewer/b)', '[@B](#mr-mention/reviewer/b) ???',
    '[@A](#mr-mention/reviewer/a) [@B](#mr-mention/reviewer/b)',
    '> [@B](#mr-mention/reviewer/b) explain', '`[@B](#mr-mention/reviewer/b)`']) {
    const f = fixture(body);
    await f.queue();
    assert.deepEqual(f.starts, [], body);
    assert.deepEqual(f.warnings, [], body);
  }
});

test('an addressed no-reply completion stays silent and is cached rather than retried as an error', async () => {
  const f = fixture('[@B](#mr-mention/reviewer/b) thanks, no further question');
  await f.queue();
  await f.queue();
  assert.deepEqual(f.starts, ['b']);
  assert.deepEqual(f.warnings, []);
  assert.equal(f.discussion.children.length, 1);
  f.discussion.children[0].body = '[@B](#mr-mention/reviewer/b) can you explain the evidence?';
  await f.queue();
  assert.deepEqual(f.starts, ['b', 'b']);
});
