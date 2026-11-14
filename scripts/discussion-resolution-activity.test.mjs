import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const base = new URL('../frontend/features/virtual-mr/', import.meta.url);
const event = { id: 'resolution', sessionId: 'mr', discussionId: 'thread', action: 'resolved',
  actorId: 'alice@test', actorName: 'Alice', reviewerName: 'Stage0 AI (Tester)', filePath: 'src/cart.ts', createdAt: '2026-11-13T00:00:01Z' };

export function resolutionFixture(persist = async () => {}, sourceOverride) {
  let state = { currentRepoId: 'repo', sessions: [{ id: 'mr', assignee: { name: 'Bob', email: 'bob@test' },
    discussions: [{ id: 'thread', isResolved: false, rootComment: { authorType: 'ai_agent', authorId: 'tester' }, children: [] }] }] };
  const calls = [], resolved = [], invalidated = [];
  const services = { discussions: {
    resolveMrDiscussion: async input => { calls.push(input); return persist(); },
    listMrDiscussions: async () => state.sessions[0].discussions,
    listMrDeletionActivity: async () => [], listMrDiscussionActivity: async () => [event],
  } };
  const mocks = {
    '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => services },
    '../utils/fromDbDiscussion': { fromDbDiscussion: item => item },
    '../utils/parseReviewerReviewCommand': { parseReviewerReviewCommand: () => null },
    '../../ai/constants/runtimeAvailability': { AI_REVIEW_UNAVAILABLE: 'Unavailable' },
    './refreshCommentPermissions': { refreshCommentPermissions: async () => {} },
    '../services/loadLocalGitAuthor': { loadLocalGitAuthor: async () => ({ name: 'Alice', email: 'alice@test' }) },
  };
  let module;
  if (sourceOverride) {
    module = {};
    const source = ts.transpileModule(sourceOverride, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require','exports',source)(id => { assert.ok(mocks[id], id); return mocks[id]; }, module);
  } else module = loadWithMocks(new URL('store/createDiscussionSlice.ts',base), mocks);
  const set = update => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; };
  const get = () => ({ ...state, ...slice, tryResolveSession: async id => resolved.push(id), invalidateReviewerApprovals: async id => invalidated.push(id) });
  const slice = module.createDiscussionSlice(set,get);
  return { slice, state: () => state, calls, resolved, invalidated };
}

test('resolve waits for persistence then loads Activity rather than claiming success optimistically', async () => {
  let commit;
  const f = resolutionFixture(() => new Promise(resolve => { commit = resolve; }));
  const pending = f.slice.resolveDiscussion('thread',true);
  assert.equal(f.state().sessions[0].discussions[0].isResolved,false);
  assert.equal(f.state().sessions[0].discussionActivity,undefined);
  commit(); await pending;
  assert.equal(f.state().sessions[0].discussions[0].isResolved,true);
  assert.deepEqual(f.state().sessions[0].discussionActivity,[event]);
  assert.deepEqual(f.resolved,['mr']);
});

test('failed resolution keeps the discussion open and never advances MR resolution or Activity', async () => {
  const f = resolutionFixture(async () => { throw Error('Audit transaction failed'); });
  await assert.rejects(f.slice.resolveDiscussion('thread',true),/Audit transaction failed/);
  assert.equal(f.state().sessions[0].discussions[0].isResolved,false);
  assert.equal(f.state().sessions[0].discussionActivity,undefined);
  assert.deepEqual(f.resolved,[]);
});

test('persisted discussion activity renders in All and History, and is excluded from Comments', async () => {
  const harness = componentHarness();
  const { VirtualMrActivityTimeline } = loadWithMocks(new URL('components/overview/VirtualMrActivityTimeline.tsx',base), {
    react: harness.react, '../DiscussionThread': { DiscussionThread: () => null },
    ...Object.fromEntries(['Trash2','CheckCircle2','Bot','Edit2','GitCommit','MessageSquare','Plus','SortAscending','SortDescending','Tag','User']
      .map(name => [`../../../../common/components/icons/${name}`, { [name]: name }])),
  });
  const session = { id: 'mr', title: 'MR', description: '', assignee: { name: 'Bob', email: 'bob@test' },
    labels: [], reviewers: [], commits: [], discussions: [], discussionActivity: [event], createdAt: '2026-11-13T00:00:00Z' };
  let nodes;
  const render = async () => { nodes = componentNodes(await harness.render(VirtualMrActivityTimeline,{session})); };
  const events = () => nodes.filter(node => node.props?.['data-discussion-activity-id']);
  await render();
  assert.equal(events().length,1);
  const text = nodes.flatMap(node => [node.props?.children].flat(Infinity)).filter(value => typeof value === 'string').join(' ');
  assert.match(text,/Alice/); assert.match(text,/resolved a discussion by/); assert.match(text,/Stage0 AI \(Tester\)/); assert.match(text,/src\/cart.ts/);
  const button = word => nodes.find(node => node.type === 'button' && [node.props.children].flat(Infinity).includes(word));
  button('History only').props.onClick(); await render(); assert.equal(events().length,1);
  const comments = nodes.find(node => node.type === 'button' && [node.props.children].flat(Infinity).some(value => typeof value === 'string' && value.startsWith('Comments')));
  comments.props.onClick(); await render(); assert.equal(events().length,0);
  harness.cleanup();
});

test('resolution history remains prior MR activity even after the original thread is removed', () => {
  const { hasVirtualMrActivity } = loadWithMocks(new URL('utils/virtualMrActivity.ts',base), {});
  assert.equal(hasVirtualMrActivity({ discussions: [], reviewers: [], commits: [], discussionActivity: [event] }),true);
});
