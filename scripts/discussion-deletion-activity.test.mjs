import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const base = new URL('../frontend/features/virtual-mr/', import.meta.url);
const activity = (id, kind, time) => ({
  id, sessionId: 'mr', discussionId: 'thread', commentId: `comment-${id}`, targetKind: kind,
  actorId: 'alice@test', actorName: 'Alice', createdAt: time,
});
const history = [
  activity('first', 'reply', '2026-11-02T01:00:00Z'),
  activity('second', 'discussion', '2026-11-02T02:00:00Z'),
];
const text = (node) => typeof node === 'string' ? node
  : Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : '';

test('Activity retains deletions after the discussion disappears, with History filtering and chronological sorting', async () => {
  const harness = componentHarness();
  const { VirtualMrActivityTimeline } = loadWithMocks(new URL('components/overview/VirtualMrActivityTimeline.tsx', base), {
    react: harness.react,
    ...Object.fromEntries(['SortAscending', 'SortDescending', 'Bot', 'Edit2', 'GitCommit', 'MessageSquare', 'Plus', 'Tag', 'User', 'Trash2']
      .map((name) => [`../../../../common/components/icons/${name}`, { [name]: name }])),
    '../DiscussionThread': { DiscussionThread: () => null },
  });
  const session = {
    id: 'mr', assignee: { name: 'Alice', email: 'alice@test' }, createdAt: '2026-11-02T00:00:00Z',
    labels: [], reviewers: [], commits: [], discussions: [], deletionActivity: history,
  };
  const render = async () => componentNodes(await harness.render(VirtualMrActivityTimeline, { session }));
  const deletionIds = (nodes) => nodes.filter((node) => node.props?.['data-deletion-activity-id'])
    .map((node) => node.props['data-deletion-activity-id']);
  let nodes = await render();
  assert.deepEqual(deletionIds(nodes), ['first', 'second']);
  const event = nodes.find((node) => node.props?.['data-deletion-activity-id'] === 'second');
  assert.match(text(event), /Alice.*deleted a discussion/);
  assert.ok(componentNodes(event).some((node) => node.type === 'time' && node.props.dateTime === history[1].createdAt));
  nodes.find((node) => node.type === 'button' && text(node) === 'History only').props.onClick();
  nodes = await render();
  assert.deepEqual(deletionIds(nodes), ['first', 'second']);
  nodes.find((node) => node.type === 'button' && node.props.title).props.onClick();
  nodes = await render();
  assert.deepEqual(deletionIds(nodes), ['second', 'first']);
  nodes.find((node) => node.type === 'button' && text(node).startsWith('Comments')).props.onClick();
  assert.deepEqual(deletionIds(await render()), []);
  harness.cleanup();
});

test('refreshing a reopened MR reloads persisted audit history even with no remaining discussions', async () => {
  let state = { currentRepoId: 'repo', sessions: [{ id: 'mr', assignee: {}, discussions: [] }] };
  const { createDiscussionSlice } = loadWithMocks(new URL('store/createDiscussionSlice.ts', base), {
    '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({ discussions: {
      listMrDiscussions: async () => [], listMrDeletionActivity: async () => structuredClone(history),
    } }) },
  });
  const slice = createDiscussionSlice((update) => { state = { ...state, ...update(state) }; }, () => state);
  await slice.refreshDiscussions('mr');
  assert.deepEqual(state.sessions[0].deletionActivity, history);
  assert.deepEqual(state.sessions[0].discussions, []);
});

test('initial repository hydration includes persisted deletion history', async () => {
  let state = { sessions: [], closedSessionTabIds: [], fetchRemotesDetailed() {}, fetchTags() {} };
  const { createRepoDataSlice } = loadWithMocks(new URL('store/slices/createRepoDataSlice.ts', base), {
    '../../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({
      repositorySettings: { getRepoSettings: async () => null, listRepoLabels: async () => [] },
      virtualMrs: { listVirtualMrSessions: async () => [{ id: 'mr', repo_id: 'repo', status: 'open', created_at: '2026-11-02T00:00:00Z' }] },
      discussions: { listMrDiscussions: async () => [], listMrDeletionActivity: async () => structuredClone(history) },
      gitHistory: { getCommitsBetweenRefs: async () => [], getGitUserIdentityCmd: async () => ['Alice', 'alice@test'] },
    }) },
    '../../services/sessionPersistence': { flushSessionWrites: async () => {} },
    '../../utils/virtualMrTitleHistory': { loadSessionTitleHistory: () => [] },
    '../../types/virtualMr': { AVAILABLE_AI_BOTS: [] },
  });
  const slice = createRepoDataSlice((update) => { state = { ...state, ...update }; }, () => state, {});
  await slice.loadRepoData('repo', '/repo', ['main']);
  assert.deepEqual(state.sessions[0].deletionActivity, history);
  assert.deepEqual(state.sessions[0].discussions, []);
});
