import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
const { create } = createRequire(import.meta.url)('zustand');
const base = new URL('../frontend/', import.meta.url);

const run = (status = 'running', extra = {}) => ({
  id: 'run', sessionId: 'mr', reviewerId: 'bot', status, findings: [], turns: 0,
  generatedDescription: null, ...extra,
});

test('a discussion refresh failure cannot leave a finished reviewer badge pending/reviewing', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const statuses = [];
  const { useReviewStore: store } = loadWithMocks(new URL('features/review/store/useReviewStore.ts', base), {
    zustand: { create },
    '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: { getState: () => ({
      setReviewerReviewStatus: async (...args) => { statuses.push(args); },
      tryResolveSession: async () => {},
      refreshDiscussions: async () => {
        assert.deepEqual(statuses, [['mr', 'bot', 'failed']]);
        throw new Error('Refresh unavailable');
      },
    }) } },
    '../services/assignedReviewService': { flushQueuedReReviewAfterActive: async () => {} },
  });
  store.setState({ activeRuns: { run: run() } });
  await store.getState().syncRun({ run: run('failed'), events: [] });
  assert.deepEqual(statuses, [['mr', 'bot', 'failed']]);
  assert.equal(store.getState().lastFinishedRun.status, 'failed');
  assert.deepEqual(store.getState().activeRuns, {});
});

test('reply failures retain the full-review assignment verdict', async () => {
  const statuses = [];
  const { useReviewStore: store } = loadWithMocks(new URL('features/review/store/useReviewStore.ts', base), {
    zustand: { create },
    '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: { getState: () => ({
      setReviewerReviewStatus: async (...args) => { statuses.push(args); }, refreshDiscussions: async () => {},
    }) } },
    '../services/assignedReviewService': { flushQueuedReReviewAfterActive: async () => {} },
  });
  store.setState({ activeRuns: { run: run('running', { replyDiscussionId: 'thread' }) } });
  await store.getState().syncRun({ run: run('failed', { replyDiscussionId: 'thread' }), events: [] });
  assert.deepEqual(statuses, []);
});

test('sidebar renders distinct error, interrupted, incomplete and cancelled badges', async () => {
  const harness = componentHarness();
  const { VirtualMrOverviewSidebar } = loadWithMocks(new URL('features/virtual-mr/components/overview/VirtualMrOverviewSidebar.tsx', base), {
    react: harness.react,
    '../../../../common/hooks/useOutsideDismiss': { useOutsideDismiss() {} },
    ...Object.fromEntries(['Check', 'Plus', 'X'].map((name) => [`../../../../common/components/icons/${name}`, { [name]: name }])),
    '../../../ai/store/useBotReviewersStore': { useBotReviewersStore: () => ({ getEffectiveReviewers: () => ({ reviewers: [] }) }) },
    '../../../git/store/useGitStore': { useGitStore: () => ({ currentRepo: null }) },
    '../../store/useVirtualMrStore': { useVirtualMrStore: () => ({ repoLabels: [], repoSettings: null }) },
    '../../utils/virtualMrParticipants': { getVirtualMrParticipants: () => [] },
    '../GitLabAvatar': { GitLabAvatar: () => null }, '../AiBotBadge': { AiBotBadge: () => null },
    '../useMrMetadataDropdowns': { useMrMetadataDropdowns: () => ({}) },
  });
  for (const status of ['failed', 'incomplete', 'interrupted', 'cancelled']) {
    const session = { id: 'mr', assignee: { name: 'Alice', email: 'alice@test' }, labels: [], reviewers: [{ agentId: 'bot', agentName: 'Bot', reviewStatus: status }] };
    const nodes = componentNodes(await harness.render(VirtualMrOverviewSidebar, { session }));
    const badge = nodes.find((node) => node.props?.['data-reviewer-status'] === status);
    assert.ok(badge, status);
    assert.ok(badge.props.children.includes(status));
    assert.ok(!badge.props.children.includes('Pending'));
  }
  harness.cleanup();
});

test('repository hydration preserves persisted terminal reviewer states', async () => {
  let state = { sessions: [], closedSessionTabIds: [], fetchRemotesDetailed() {}, fetchTags() {} };
  const statuses = ['failed', 'incomplete', 'interrupted', 'cancelled', 'reviewing'];
  const { createRepoDataSlice } = loadWithMocks(new URL('features/virtual-mr/store/slices/createRepoDataSlice.ts', base), {
    '../../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({
      repositorySettings: { getRepoSettings: async () => null, listRepoLabels: async () => [] },
      virtualMrs: { listVirtualMrSessions: async () => [{ id: 'mr', repo_id: 'repo', reviewers: statuses.map((review_status) => ({ agent_id: review_status, review_status })) }] },
      discussions: { listMrDiscussions: async () => [], listMrDeletionActivity: async () => [] },
      gitHistory: { getCommitsBetweenRefs: async () => [], getGitUserIdentityCmd: async () => ['Alice', 'alice@test'] },
    }) },
    '../../services/sessionPersistence': { flushSessionWrites: async () => {} },
    '../../utils/virtualMrTitleHistory': { loadSessionTitleHistory: () => [] }, '../../types/virtualMr': { AVAILABLE_AI_BOTS: [] },
  });
  await createRepoDataSlice((update) => { state = { ...state, ...update }; }, () => state, {}).loadRepoData('repo', '/repo', ['main']);
  assert.deepEqual(state.sessions[0].reviewers.map((reviewer) => reviewer.reviewStatus), statuses);
});

test('successful verdicts require a fresh discussion list before approval or resolution', async (t) => {
  t.mock.method(console, 'warn', () => {});
  for (const refreshFails of [true, false]) {
    let refreshed = false;
    const statuses = [];
    let resolved = 0;
    const { useReviewStore: store } = loadWithMocks(new URL('features/review/store/useReviewStore.ts', base), {
      zustand: { create },
      '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: { getState: () => ({
        setReviewerReviewStatus: async (...args) => { assert.equal(refreshed, true); statuses.push(args); },
        tryResolveSession: async () => { resolved++; },
        refreshDiscussions: async () => { if (refreshFails) throw new Error('Refresh failed'); refreshed = true; },
      }) } },
      '../services/assignedReviewService': { flushQueuedReReviewAfterActive: async () => {} },
    });
    store.setState({ activeRuns: { run: run() } });
    await store.getState().syncRun({ run: run('completed', { decision: 'approve' }), events: [] });
    assert.deepEqual(statuses, refreshFails ? [] : [['mr', 'bot', 'approved']]);
    assert.equal(resolved, refreshFails ? 0 : 1);
  }
});
