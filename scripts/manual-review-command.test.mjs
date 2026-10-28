import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const virtualMr = '../frontend/features/virtual-mr/';
const review = '../frontend/features/review/';
const { parseReviewerReviewCommand } = loadWithMocks(
  new URL(`${virtualMr}utils/parseReviewerReviewCommand.ts`, import.meta.url),
  { '../../../common/utils/mentions': {
    parseMentionReference: (href) => {
      const match = /^#mr-mention\/(reviewer|assignee)\/(.+)$/.exec(href);
      return match ? { kind: match[1], id: decodeURIComponent(match[2]) } : null;
    },
  } },
);

test('recognizes an exact Markdown mention plus review command and rejects quoted or ambiguous text', () => {
  assert.equal(parseReviewerReviewCommand('[@Code Reviewer](#mr-mention/reviewer/bot-1) review'), 'bot-1');
  assert.equal(parseReviewerReviewCommand('[@AI \\[A\\]](#mr-mention/reviewer/reviewer%2Fa) REVIEW'), 'reviewer/a');
  for (const body of [
    '> [@Bot](#mr-mention/reviewer/bot) review',
    '`[@Bot](#mr-mention/reviewer/bot) review`',
    '```md\n[@Bot](#mr-mention/reviewer/bot) review\n```',
    'Please [@Bot](#mr-mention/reviewer/bot) review this file',
    '[@Assignee](#mr-mention/assignee/alice) review',
    '[@Bot](#mr-mention/reviewer/bot) please review',
  ]) assert.equal(parseReviewerReviewCommand(body), null, body);
});

function setupManualRequest({ unresolved = false, waitPromise } = {}) {
  const finding = {
    id: 'finding-1', sessionId: 'mr-1', filePath: 'src/cart.ts', lineNumber: 28,
    isResolved: false,
    rootComment: {
      id: 'finding-root', discussionId: 'finding-1', authorType: 'ai_agent',
      authorId: 'bot-1', authorName: 'Stage0 AI (Code Reviewer)', body: '**[high] Price mismatch**',
      createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z',
    },
    children: [], createdAt: '2026-10-01T00:00:00Z',
  };
  const requestDiscussion = {
    id: 'request-1', sessionId: 'mr-1', filePath: null, isResolved: false,
    rootComment: { id: 'request-root', discussionId: 'request-1', authorType: 'user', authorId: 'me@example.test', authorName: 'Me', body: '[@Code Reviewer](#mr-mention/reviewer/bot-1) review', createdAt: '2026-10-28T00:00:00Z', updatedAt: '2026-10-28T00:00:00Z' },
    children: [], createdAt: '2026-10-28T00:00:00Z',
  };
  let state = { sessions: [{ id: 'mr-1', title: 'Cart MR', status: 'open', repoId: 'repo', reviewers: [{ agentId: 'bot-1', agentName: 'Code Reviewer' }], discussions: unresolved ? [finding, requestDiscussion] : [requestDiscussion] }] };
  const replies = [];
  const setState = (update) => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
  const store = {
    getState: () => ({
      sessions: state.sessions,
      refreshDiscussions: async () => {},
      replyToDiscussion: async (discussionId, body, _action, authorType, authorName, authorId) => {
        const comment = { id: `reply-${replies.length}`, discussionId, body, authorType, authorName, authorId };
        replies.push(comment);
        setState((current) => ({ sessions: current.sessions.map((session) => ({ ...session, discussions: session.discussions.map((discussion) => discussion.id === discussionId ? { ...discussion, children: [...discussion.children, comment] } : discussion) })) }));
      },
    }),
    setState,
  };
  let starts = 0;
  const notifications = [];
  let resolveWait;
  const deferred = waitPromise || new Promise((resolve) => { resolveWait = resolve; });
  const module = loadWithMocks(new URL(`${review}services/manualReviewerRequestService.ts`, import.meta.url), {
    '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({}) },
    '../../notifications/services/notificationService': { notificationService: { notify: async (item) => notifications.push(item) } },
    '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: store },
    '../../virtual-mr/utils/discussionReferences': { getDiscussionComments: (discussion) => discussion.rootComment ? [discussion.rootComment, ...discussion.children] : discussion.children },
    '../store/useReviewStore': { useReviewStore: { getState: () => ({ activeRuns: {}, reviewBatches: {} }) }, isReviewStartingForSession: () => false },
    './assignedReviewService': {
      getAssignedReviewerForSession: () => ({ id: 'bot-1', name: 'Code Reviewer', profile: { id: 'bot-1' } }),
      startAssignedReviewerReview: async () => { starts++; return { id: 'run-1' }; },
      waitForReviewRun: () => deferred,
    },
    '../../../common/utils/mentions': { formatMention: () => '[@Code Reviewer](#mr-mention/reviewer/bot-1)' },
  });
  return { request: module.requestManualReviewerReview, state: () => state, replies, notifications, starts: () => starts, resolveWait, addFinding: () => setState((current) => ({ sessions: current.sessions.map((session) => ({ ...session, discussions: [...session.discussions, { ...finding, id: 'finding-new', rootComment: { ...finding.rootComment, id: 'new-root' } }] })) })) };
}

test('manual request posts bot progress, shows a pending skeleton, reports findings and notifies', async () => {
  const harness = setupManualRequest();
  const request = harness.request('mr-1', 'request-1', 'bot-1');
  await new Promise((resolve) => setImmediate(resolve));
  const parent = harness.state().sessions[0].discussions.find((item) => item.id === 'request-1');
  assert.ok(parent.children.some((comment) => comment.isPending));
  assert.match(harness.replies[0].body, /Review request accepted/);
  harness.addFinding();
  harness.resolveWait({ id: 'run-1', status: 'completed', findings: [] });
  await request;
  assert.equal(harness.starts(), 1);
  assert.ok(!harness.state().sessions[0].discussions.find((item) => item.id === 'request-1').children.some((comment) => comment.isPending));
  assert.match(harness.replies.at(-1).body, /created 1 new code discussion/);
  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.notifications[0].channel, 'aiReview');
});

test('manual request refuses to run while that reviewer has an unresolved code finding', async () => {
  const harness = setupManualRequest({ unresolved: true, waitPromise: Promise.resolve({ id: 'unused', status: 'completed', findings: [] }) });
  await harness.request('mr-1', 'request-1', 'bot-1');
  assert.equal(harness.starts(), 0);
  assert.match(harness.replies.at(-1).body, /Review paused/);
  assert.match(harness.replies.at(-1).body, /src\/cart\.ts:28/);
  assert.equal(harness.notifications.length, 0);
});
