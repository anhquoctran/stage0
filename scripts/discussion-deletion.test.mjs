import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const base = new URL('../frontend/features/virtual-mr/', import.meta.url);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const comment = (id, canDelete = true, authorType = 'user') => ({
  id, discussionId: 'thread', canDelete, authorType, authorId: 'alice@test', authorName: 'Alice',
  body: 'Text', createdAt: '2026-11-02T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z',
});
const thread = (children = []) => ({ id: 'thread', sessionId: 'mr', rootComment: comment('root'), children });

async function deletionFixture({ persist, animate = async () => {}, children = [] } = {}) {
  const harness = componentHarness();
  let state = { sessions: [{ id: 'mr', discussions: [thread(children)] }] };
  const calls = [], toasts = [];
  let refreshes = 0;
  const store = {
    getState: () => ({ ...state, refreshDiscussions: async () => { refreshes++; } }),
    setState: (update) => { state = { ...state, ...update(state) }; },
  };
  const { useDiscussionDeletion } = loadWithMocks(new URL('hooks/useDiscussionDeletion.ts', base), {
    react: harness.react,
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => ({
      discussions: { deleteMrComment: async (args) => { calls.push(args);
        const result = await persist(args);
        return { ...result, activity: {
          id: 'deletion-event', sessionId: 'mr', discussionId: 'thread', commentId: args.commentId,
          targetKind: result.deletedDiscussion ? 'discussion' : 'reply', actorName: 'Alice', actorId: 'alice@test',
          createdAt: '2026-11-02T00:00:00Z',
        } }; } },
    }) },
    '../../git/store/useGitStore': { useGitStore: { getState: () => ({ showToast: (...args) => toasts.push(args) }) } },
    '../store/useVirtualMrStore': { useVirtualMrStore: store },
    '../utils/animateCommentRemoval': { animateCommentRemoval: animate },
  });
  const hook = await harness.render(() => useDiscussionDeletion('mr'));
  return { hook, state: () => state, calls, toasts, refreshes: () => refreshes };
}

test('deletion persists before animation, waits for disappearance, and ignores rapid duplicate clicks', async () => {
  const api = deferred(), animation = deferred();
  let animations = 0;
  const fixture = await deletionFixture({
    children: [comment('reply')],
    persist: () => api.promise,
    animate: () => { animations++; return animation.promise; },
  });
  const pending = fixture.hook.remove('reply', {});
  await fixture.hook.remove('reply', {});
  assert.equal(fixture.calls.length, 1);
  assert.equal(animations, 0);
  assert.equal(fixture.state().sessions[0].discussions[0].children.length, 1);
  api.resolve({ discussionId: 'thread', deletedDiscussion: false });
  await new Promise(setImmediate);
  assert.equal(animations, 1);
  assert.equal(fixture.state().sessions[0].discussions[0].children.length, 1);
  animation.resolve();
  await pending;
  assert.equal(fixture.state().sessions[0].discussions[0].children.length, 0);
  assert.equal(fixture.state().sessions[0].discussions[0].rootComment.id, 'root');
  assert.equal(fixture.refreshes(), 1);
  assert.equal(fixture.state().sessions[0].deletionActivity[0].targetKind, 'reply');
});

test('root deletion removes the discussion; a rejected deletion preserves it and refreshes stale permissions', async () => {
  const success = await deletionFixture({ persist: async () => ({ discussionId: 'thread', deletedDiscussion: true }) });
  await success.hook.remove('root', {});
  assert.deepEqual(success.state().sessions[0].discussions, []);
  assert.equal(success.state().sessions[0].deletionActivity[0].targetKind, 'discussion');
  let animations = 0;
  const failure = await deletionFixture({
    persist: async () => { throw new Error('A reply was just added'); },
    animate: async () => { animations++; },
  });
  await failure.hook.remove('root', {});
  assert.equal(failure.state().sessions[0].discussions[0].rootComment.id, 'root');
  assert.equal(animations, 0);
  assert.equal(failure.state().sessions[0].deletionActivity, undefined);
  assert.equal(failure.refreshes(), 1);
  assert.match(failure.toasts[0][0], /A reply was just added/);
  assert.equal(failure.toasts[0][1], 'error');
});

test('animation respects reduced motion and cancellation does not prevent deleting persisted content', async (t) => {
  const { animateCommentRemoval } = loadWithMocks(new URL('utils/animateCommentRemoval.ts', base), {});
  const original = globalThis.matchMedia;
  t.after(() => { globalThis.matchMedia = original; });
  let calls = 0, cancelled = 0;
  const element = {
    getBoundingClientRect: () => ({ height: 100 }),
    animate: () => { calls++; return { finished: Promise.reject(new Error('Unmounted')), cancel: () => { cancelled++; } }; },
  };
  globalThis.matchMedia = () => ({ matches: true });
  await animateCommentRemoval(element);
  assert.equal(calls, 0);
  globalThis.matchMedia = () => ({ matches: false });
  await animateCommentRemoval(element);
  assert.equal(calls, 1);
  assert.equal(cancelled, 1);
  await animateCommentRemoval({});
});

test('trash buttons require a server permission hint, human author, and no subsequent replies or pending AI work', async () => {
  const harness = componentHarness();
  const { DiscussionThread } = loadWithMocks(new URL('components/DiscussionThread.tsx', base), {
    react: harness.react,
    '../hooks/useDiscussionDeletion': { useDiscussionDeletion: () => ({ isDeleting: false, remove: async () => {} }) },
    '../../git/store/useGitStore': { useGitStore: () => ({ showToast() {} }) },
    '../store/useVirtualMrStore': { useVirtualMrStore: () => ({}) },
    '../../../common/components/MarkdownPreview': { MarkdownPreview: 'Preview' },
    '../../../common/components/MarkdownEditor': { MarkdownEditor: 'Editor' },
    '../../../common/components/icons/Quote': { Quote: 'Quote' },
    '../../../common/components/icons/Trash2': { Trash2: 'Trash' },
    './discussion/DiscussionReplyBox': { DiscussionReplyBox: () => null },
    './discussion/PendingDiscussionReply': { PendingDiscussionReply: () => null },
  });
  const count = async (discussion) => {
    const session = { id: 'mr', assignee: { name: 'Alice', email: 'alice@test' }, discussions: [discussion] };
    const tree = await harness.render(DiscussionThread, { session, discussion });
    return componentNodes(tree).filter((node) => node.type === 'button'
      && node.props['aria-label'] === 'Delete your comment or discussion').length;
  };
  assert.equal(await count(thread()), 1);
  assert.equal(await count({ ...thread(), rootComment: comment('root', false) }), 0);
  assert.equal(await count({ ...thread(), rootComment: comment('root', true, 'ai_agent') }), 0);
  assert.equal(await count(thread([comment('reply')])), 1, 'only the latest reply can be deleted');
  assert.equal(await count(thread([comment('reply'), { ...comment('pending'), isPending: true }])), 0);
  assert.equal(await count(thread([comment('reply', false)])), 0, 'quoted reply has no trash button');
  harness.cleanup();
});

test('transport preserves the comment ID and normalizing discussions fails closed without server permission', async () => {
  const calls = [];
  const { createDiscussionService } = loadWithMocks(new URL('services/transport/createDiscussionService.ts', base), {});
  const service = createDiscussionService({ executeCommand: async (...args) => calls.push(args) });
  await service.deleteMrComment({ commentId: 'reply' });
  assert.deepEqual(calls, [['delete_mr_comment', { commentId: 'reply' }]]);
  const { fromDbDiscussion } = loadWithMocks(new URL('utils/fromDbDiscussion.ts', base), {});
  const item = { comments: [{ id: 'root', can_delete: true }, { id: 'reply' }] };
  assert.equal(fromDbDiscussion(item).rootComment.canDelete, true);
  assert.equal(fromDbDiscussion(item).children[0].canDelete, false);
});

test('new human posts use local Git identity and immediately refresh deletion hints without relabeling the assignee', async () => {
  let state = { currentRepoId: 'repo', currentRepoPath: '/repo', sessions: [{
    id: 'mr', assignee: { name: 'Bob', email: 'bob@test' }, discussions: [],
  }], invalidateReviewerApprovals: async () => {} };
  const records = [];
  const { createDiscussionSlice } = loadWithMocks(new URL('store/createDiscussionSlice.ts', base), {
    '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({
      gitHistory: { getGitUserIdentityCmd: async () => ['Alice', 'alice@test'] },
      discussions: {
        createMrDiscussion: async ({ discussion, firstComment }) => records.push({ ...discussion, comments: [{ ...firstComment, can_delete: true }] }),
        addMrComment: async ({ comment }) => records[0].comments.push({ ...comment, can_delete: true }),
        listMrDiscussions: async () => structuredClone(records),
      },
    }) },
    '../../review/services/assignedReviewService': { queueAssignedDiscussionReply: async () => {} },
  });
  const slice = createDiscussionSlice((update) => {
    state = { ...state, ...(typeof update === 'function' ? update(state) : update) };
  }, () => state);
  await slice.createDiscussion('mr', { initialComment: 'New discussion' });
  assert.equal(state.sessions[0].discussions[0].rootComment.authorId, 'alice@test');
  assert.equal(state.sessions[0].discussions[0].rootComment.canDelete, true);
  const discussionId = records[0].id;
  await slice.replyToDiscussion(discussionId, 'Reply');
  assert.equal(state.sessions[0].discussions[0].children[0].authorId, 'alice@test');
  assert.equal(state.sessions[0].discussions[0].children[0].canDelete, true);
  assert.equal(state.sessions[0].assignee.email, 'bob@test');
});
