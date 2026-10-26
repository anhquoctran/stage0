import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const { create } = require('zustand');
const refs = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/discussionReferences.ts', import.meta.url), {});
const mentionUtils = loadWithMocks(new URL('../frontend/common/utils/mentions.ts', import.meta.url), {});
const discussionMentions = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/discussionMentions.ts', import.meta.url), {});
const { fromDbDiscussion } = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/fromDbDiscussion.ts', import.meta.url), {});
const comment = (id, discussionId, body) => ({ id, discussionId, body, authorType: 'user', authorId: 'user@test', authorName: 'User', createdAt: '2026-10-21T00:00:00Z', updatedAt: '2026-10-21T00:00:00Z' });
const session = () => ({ id: 'mr', assignee: { name: 'Alice', email: 'alice@test' }, reviewers: [], status: 'open', discussions: [
  { id: 'd1', sessionId: 'mr', isResolved: false, rootComment: comment('c1', 'd1', 'Root one'), children: [comment('c3', 'd1', 'Child reply')] },
  { id: 'd2', sessionId: 'mr', isResolved: false, rootComment: comment('c2', 'd2', 'Root two'), children: [] },
] });

function storeFixture(beforeWrite = async () => {}) {
  const records = new Map();
  const writes = [];
  const store = loadWithMocks(new URL('../frontend/features/virtual-mr/store/useVirtualMrStore.ts', import.meta.url), {
    zustand: { create },
    '@tauri-apps/api/core': { invoke: async (command, args) => {
      if (command === 'list_mr_discussions') return [...records.values()];
      writes.push([command, structuredClone(args)]);
      await beforeWrite(command, args);
      if (command === 'create_mr_discussion') records.set(args.discussion.id, { ...args.discussion, comments: [args.firstComment] });
      if (command === 'add_mr_comment') records.get(args.comment.discussion_id)?.comments.push(args.comment);
    } },
    '../../git/store/useGitStore': { useGitStore: { getState: () => ({ showToast() {} }) } },
    '../../ai/store/useBotReviewersStore': {},
    '../types/virtualMr': { AVAILABLE_AI_BOTS: [], PRESET_REPO_LABELS: [] },
    '../../ai/constants/runtimeAvailability': {},
    '../utils/fromDbDiscussion': { fromDbDiscussion },
    '../services/sessionPersistence': {},
    '../../review/services/assignedReviewService': { reReviewAssignedSession: async () => {}, queueAssignedDiscussionReply: async () => {} },
  }).useVirtualMrStore;
  store.setState({ currentRepoId: 'repo', sessions: [session()], invalidateReviewerApprovals: async () => {} });
  return { store, records, writes };
}

test('discussion and reply IDs are unique; replies preserve parent, author and quote references after reload', async () => {
  const { store, records } = storeFixture();
  await Promise.all(Array.from({ length: 3 }, () => store.getState().createDiscussion('mr', { initialComment: 'New topic' })));
  const discussions = [...records.values()];
  assert.equal(new Set(discussions.flatMap((item) => [item.id, item.comments[0].id])).size, 6);
  const id = discussions[0].id;
  const quote = refs.buildDiscussionQuote(fromDbDiscussion(discussions[1]));
  await Promise.all([
    store.getState().replyToDiscussion(id, `${quote}Reply A`),
    store.getState().replyToDiscussion(id, 'Reply B'),
  ]);
  const saved = records.get(id).comments;
  assert.equal(saved.length, 3);
  assert.equal(new Set(saved.map((item) => item.id)).size, 3);
  for (const reply of saved.slice(1)) {
    assert.equal(reply.discussion_id, id);
    assert.equal(reply.author_id, 'alice@test');
    assert.equal(reply.author_name, 'Alice');
  }
  await store.getState().refreshDiscussions('mr');
  const loaded = store.getState().sessions[0].discussions.find((item) => item.id === id);
  assert.equal(loaded.children.length, 2);
  assert.equal(loaded.rootComment.id, saved[0].id);
  assert.ok(loaded.children.some((item) => item.body === `${quote}Reply A`));
});

test('failed writes and missing parents do not publish phantom discussions or replies', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { store, writes } = storeFixture(async () => { throw new Error('Disk full'); });
  const before = store.getState().sessions;
  await assert.rejects(store.getState().createDiscussion('mr', { initialComment: 'New topic' }), /Disk full/);
  await assert.rejects(store.getState().replyToDiscussion('d1', 'Reply'), /Disk full/);
  assert.equal(store.getState().sessions, before);
  await assert.rejects(store.getState().replyToDiscussion('missing', 'Reply'), /no longer available/);
  await assert.rejects(store.getState().replyToDiscussion('d1', '  '), /empty/);
  assert.equal(writes.length, 2);
});

test('a completed write cannot restore state from a repository that was switched away', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { store } = storeFixture(() => gate);
  const reply = store.getState().replyToDiscussion('d1', 'Reply');
  assert.equal(store.getState().sessions[0].discussions[0].children.length, 1);
  store.setState({ currentRepoId: 'other-repo', sessions: [] });
  release();
  await reply;
  assert.deepEqual(store.getState().sessions, []);
});

test('quotes distinguish discussion/comment IDs, escape labels and retain multiline content', () => {
  const discussion = session().discussions[0];
  discussion.rootComment.authorName = '[Author](https://example.test)';
  discussion.rootComment.body = 'Line 1\r\n\nLine 2';
  const quote = refs.buildDiscussionQuote(discussion);
  assert.match(quote, /\(#mr-discussion\/d1\)/);
  assert.ok(quote.includes('\\[Author\\]'));
  assert.ok(quote.includes('> Line 1\n> \n> Line 2'));
  assert.match(refs.buildDiscussionQuote(discussion, discussion.children[0]), /\(#mr-comment\/c3\)/);
  assert.deepEqual(refs.parseDiscussionReference('#mr-comment/c%2F3'), { kind: 'comment', id: 'c/3' });
  assert.equal(refs.parseDiscussionReference('https://example.test/#mr-comment/c3'), null);
  assert.equal(refs.parseDiscussionReference('#mr-comment/%broken'), null);
});

async function threadFixture(reply = async () => {}) {
  const harness = componentHarness();
  const item = session();
  const posts = [];
  const toasts = [];
  const { DiscussionThread } = loadWithMocks(new URL('../frontend/features/virtual-mr/components/DiscussionThread.tsx', import.meta.url), {
    react: harness.react,
    '../../../common/components/CustomSelect': { CustomSelect: 'Select' },
    '../../../common/components/MarkdownEditor': { MarkdownEditor: 'Editor' },
    '../../../common/components/MarkdownPreview': { MarkdownPreview: 'Preview' },
    '../../../common/components/icons/Quote': { Quote: 'Quote' },
    '../../../common/utils/dateTime': { formatTime: () => 'Today' },
    '../../git/store/useGitStore': { useGitStore: () => ({ showToast: (...args) => toasts.push(args) }) },
    '../store/useVirtualMrStore': { useVirtualMrStore: () => ({
      replyToDiscussion: async (...args) => { posts.push(['reply', ...args]); await reply(); },
      createDiscussion: async (...args) => { posts.push(['discussion', ...args]); },
    }) },
    '../utils/discussionReferences': refs,
    '../utils/discussionMentions': discussionMentions,
    '../../../common/utils/mentions': mentionUtils,
    './DiscussionReferenceDialog': { DiscussionReferenceDialog: 'ReferenceDialog' },
  });
  let tree;
  let nodes;
  const render = async () => {
    tree = await harness.render(DiscussionThread, { session: item, discussion: item.discussions[0] });
    nodes = componentNodes(tree);
  };
  const labelled = (label) => nodes.find((node) => node.props?.['aria-label'] === label);
  const editor = () => nodes.find((node) => node.type === 'Editor');
  const click = async (label) => { labelled(label).props.onClick(); await render(); };
  const follow = async (href) => {
    let prevented = false;
    tree.props.onClick({ target: { closest: () => ({ getAttribute: () => href }) }, preventDefault: () => { prevented = true; }, stopPropagation() {} });
    await render();
    return prevented;
  };
  await render();
  return { render, labelled, editor, click, posts, toasts, follow, nodes: () => nodes };
}

test('quote a discussion into another thread, or quote a child comment into a new discussion', async () => {
  const view = await threadFixture();
  await view.click('Quote discussion d1');
  assert.match(view.editor().props.value, /#mr-discussion\/d1/);
  view.labelled('Reply destination').props.onChange('d2');
  await view.render();
  await view.editor().props.onSubmit();
  assert.equal(view.posts[0][0], 'reply');
  assert.equal(view.posts[0][1], 'd2');
  await view.render();
  await view.click('Quote comment c3');
  assert.match(view.editor().props.value, /#mr-comment\/c3/);
  view.labelled('Reply destination').props.onChange('new');
  await view.render();
  await view.editor().props.onSubmit();
  assert.equal(view.posts[1][0], 'discussion');
  assert.equal(view.posts[1][1], 'mr');
  assert.match(view.posts[1][2].initialComment, /Child reply/);
});

test('reply errors retain drafts and rapid submits send only one write', async () => {
  let rejectWrite;
  const pending = new Promise((_, reject) => { rejectWrite = reject; });
  const view = await threadFixture(() => pending);
  await view.click('Reply to discussion d1');
  view.editor().props.onChange('Keep this draft');
  await view.render();
  const submit = view.editor().props.onSubmit;
  const first = submit();
  const second = submit();
  assert.equal(view.posts.length, 1);
  rejectWrite(new Error('Disk full'));
  await Promise.all([first, second]);
  await view.render();
  assert.equal(view.editor().props.value, 'Keep this draft');
  assert.equal(view.editor().props.isSubmitting, false);
  assert.equal(view.toasts.at(-1)[1], 'error');
});

test('quote links resolve exact source IDs; unavailable sources give feedback', async () => {
  const view = await threadFixture();
  assert.equal(await view.follow('#mr-comment/c2'), true);
  let dialog = view.nodes().find((node) => node.type === 'ReferenceDialog');
  assert.equal(dialog.props.discussion.id, 'd2');
  assert.equal(dialog.props.comment.id, 'c2');
  assert.equal(await view.follow('#mr-discussion/d1'), true);
  dialog = view.nodes().find((node) => node.type === 'ReferenceDialog');
  assert.equal(dialog.props.discussion.id, 'd1');
  assert.equal(dialog.props.comment, undefined);
  await view.follow('#mr-comment/missing');
  assert.equal(view.toasts.at(-1)[1], 'warning');
  assert.equal(await view.follow('https://example.test'), false);
});
