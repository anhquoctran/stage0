import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const path = '../frontend/features/';
const { parseReviewerReviewCommands } = loadWithMocks(new URL(`${path}virtual-mr/utils/parseReviewerReviewCommand.ts`, import.meta.url), {});
const { addressedDiscussionReplyRecipients } = loadWithMocks(new URL(`${path}review/utils/discussionReplyRecipients.ts`, import.meta.url), {});
const body = '[@One](#mr-mention/reviewer/one) [@Two](#mr-mention/reviewer/two) [@Three](#mr-mention/reviewer/three) review';

test('root review grammar agrees with Rust and deduplicates mentions without accepting prose or quoted commands', () => {
  const cases = JSON.parse(fs.readFileSync(new URL('../backend/test-data/manual-review-commands.json', import.meta.url)));
  for (const entry of cases) assert.deepEqual(parseReviewerReviewCommands(entry.body), entry.targets, entry.body);
});

test('review commands in replies never enqueue a full run or a model relevance check', () => {
  const root = { id: 'root', body: 'Ordinary root', authorType: 'user', authorId: 'alice' };
  const reply = { id: 'reply', body, authorType: 'user', authorId: 'alice' };
  const discussion = { id: 'thread', rootComment: root, children: [reply] };
  assert.deepEqual(addressedDiscussionReplyRecipients(discussion, ['one', 'two', 'three']), []);
  reply.body = '[@Two](#mr-mention/reviewer/two) Please explain this condition';
  assert.deepEqual(addressedDiscussionReplyRecipients(discussion, ['one', 'two', 'three']), ['two']);
});

function fixture({ blocked = [], failed = [], missing = [] } = {}) {
  const discussion = { id: 'thread', isResolved: false, rootComment: { id: 'root', body, authorType: 'user' }, children: [] };
  const findings = blocked.map(id => ({ id: `finding-${id}`, filePath: 'src/file.rs', isResolved: false,
    rootComment: { authorType: 'ai_agent', authorId: id, body: 'Fix this finding' }, children: [] }));
  let state = { sessions: [{ id: 'mr', status: 'open', discussions: [discussion, ...findings] }] };
  const reviews = { activeRuns: {}, reviewBatches: {}, setReviewBatch: (id, value) => {
    if (value) reviews.reviewBatches[id] = value; else delete reviews.reviewBatches[id];
  } };
  const starts = [], replies = [], waits = new Map();
  const store = { getState: () => ({ ...state, refreshDiscussions: async () => {},
    replyToDiscussion: async (_id, text, _action, _kind, _name, id) => { replies.push({ id, text }); } }),
    setState: update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; } };
  const service = loadWithMocks(new URL(`${path}review/services/manualReviewerRequestService.ts`, import.meta.url), {
    '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: store },
    '../store/useReviewStore': { useReviewStore: { getState: () => reviews }, isReviewStartingForSession: () => false },
    './assignedReviewService': {
      getAssignedReviewerForSession: (_mr, id) => ({ id, name: id, profile: missing.includes(id) ? null : { id } }),
      startAssignedReviewerReview: async (_mr, id) => {
        starts.push(id);
        if (failed.includes(id)) throw new Error('Fixture provider failure');
        reviews.activeRuns[id] = { sessionId: 'mr', status: 'running' }; return { id };
      },
      waitForReviewRun: id => new Promise(resolve => { waits.set(id, result => { delete reviews.activeRuns[id]; resolve(result); }); }),
    },
  });
  return { ...service, starts, replies, reviews, finish: id => waits.get(id)({ id, status: 'completed', findings: [] }) };
}
const tick = () => new Promise(setImmediate);

test('one multi-bot root command runs each unique bot sequentially and reserves the batch until completion', async () => {
  const f = fixture();
  const run = f.requestManualReviewerReviews('mr', 'thread', ['one', 'two', 'one', 'three']);
  const duplicate = f.requestManualReviewerReviews('mr', 'thread', ['one', 'two', 'three']);
  await tick(); assert.deepEqual(f.starts, ['one']); assert.equal(f.reviews.reviewBatches.mr.total, 3);
  f.finish('one'); await tick(); assert.deepEqual(f.starts, ['one', 'two']);
  f.finish('two'); await tick(); assert.deepEqual(f.starts, ['one', 'two', 'three']);
  f.finish('three'); await Promise.all([run, duplicate]);
  assert.equal(f.reviews.reviewBatches.mr, undefined);
  assert.equal(f.replies.filter(r => /accepted/i.test(r.text)).length, 3);
});

test('a blocked, missing or failed bot does not suppress eligible peers and failed runs release the batch', async () => {
  const f = fixture({ blocked: ['one'], failed: ['two'], missing: ['missing'] });
  const run = f.requestManualReviewerReviews('mr', 'thread', ['one', 'missing', 'two', 'three']);
  await tick(); assert.deepEqual(f.starts, ['two', 'three']);
  assert.ok(f.replies.some(r => r.id === 'one' && /paused/i.test(r.text)));
  assert.ok(f.replies.some(r => r.id === 'missing' && /profile/i.test(r.text)));
  assert.ok(f.replies.some(r => r.id === 'two' && /Fixture provider failure/.test(r.text)));
  f.finish('three'); await run; assert.equal(f.reviews.reviewBatches.mr, undefined);
});

test('another request cannot interrupt an in-flight multi-bot batch', async () => {
  const f = fixture(); const run = f.requestManualReviewerReviews('mr', 'thread', ['one', 'two']);
  await tick(); await f.requestManualReviewerReviews('mr', 'another-root', ['two', 'three']);
  assert.deepEqual(f.starts, ['one']);
  assert.equal(f.replies.filter(r => /already starting|running/i.test(r.text)).length, 2);
  f.finish('one'); await tick(); f.finish('two'); await run;
});

test('only a newly persisted general root command dispatches the multi-review workflow', async () => {
  let state = { sessions: [{ id: 'mr', assignee: { name: 'Alice', email: 'alice@test' }, discussions: [] }] };
  const groups = [], replies = [], services = { discussions: { createMrDiscussion: async () => {}, addMrComment: async () => {} } };
  const { createDiscussionSlice } = loadWithMocks(new URL(`${path}virtual-mr/store/createDiscussionSlice.ts`, import.meta.url), {
    '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => services },
    './refreshCommentPermissions': { refreshCommentPermissions: async () => {} },
    '../../review/services/manualReviewerRequestService': { requestManualReviewerReviews: async (...args) => groups.push(args) },
    '../../review/services/assignedReviewService': { queueAssignedDiscussionReply: async (...args) => replies.push(args) },
  });
  const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
  const get = () => ({ ...state, ...slice, invalidateReviewerApprovals: async () => {} });
  const slice = createDiscussionSlice(set, get);
  await slice.createDiscussion('mr', { initialComment: body }); await tick();
  assert.equal(groups.length, 1); assert.deepEqual(groups[0][2], ['one', 'two', 'three']);
  const id = state.sessions[0].discussions[0].id;
  await slice.replyToDiscussion(id, body); await tick();
  assert.equal(groups.length, 1); assert.equal(replies.length, 1);
  await slice.createDiscussion('mr', { initialComment: body, filePath: 'source.rs' }); await tick();
  assert.equal(groups.length, 1); assert.equal(replies.length, 2);
});
