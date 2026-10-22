import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const { buildMrSequenceMap, getMrSequenceNumber, formatMrFriendlyId } = loadWithMocks(
  new URL('../frontend/features/virtual-mr/utils/virtualMrSequence.ts', import.meta.url),
  {}
);

test('buildMrSequenceMap assigns sequential 1-based IDs based on createdAt ascending', () => {
  const sessions = [
    { id: 'mr-c', createdAt: '2026-03-01T12:00:00Z' },
    { id: 'mr-a', createdAt: '2026-01-01T10:00:00Z' },
    { id: 'mr-b', createdAt: '2026-02-01T11:00:00Z' },
  ];

  const map = buildMrSequenceMap(sessions);
  assert.equal(map.get('mr-a'), 1);
  assert.equal(map.get('mr-b'), 2);
  assert.equal(map.get('mr-c'), 3);
});

test('buildMrSequenceMap resolves ties by id ascending', () => {
  const timestamp = '2026-01-01T00:00:00Z';
  const sessions = [
    { id: 'mr-z', createdAt: timestamp },
    { id: 'mr-m', createdAt: timestamp },
    { id: 'mr-a', createdAt: timestamp },
  ];

  const map = buildMrSequenceMap(sessions);
  assert.equal(map.get('mr-a'), 1);
  assert.equal(map.get('mr-m'), 2);
  assert.equal(map.get('mr-z'), 3);
});

test('getMrSequenceNumber returns correct 1-based index for specific session', () => {
  const sessions = [
    { id: 'mr-3', createdAt: '2026-03-01T00:00:00Z' },
    { id: 'mr-1', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'mr-2', createdAt: '2026-02-01T00:00:00Z' },
  ];

  assert.equal(getMrSequenceNumber(sessions, 'mr-1'), 1);
  assert.equal(getMrSequenceNumber(sessions, 'mr-2'), 2);
  assert.equal(getMrSequenceNumber(sessions, 'mr-3'), 3);
});

test('getMrSequenceNumber falls back gracefully to 1 when session is not found or list is empty', () => {
  assert.equal(getMrSequenceNumber([], 'non-existent'), 1);
  assert.equal(getMrSequenceNumber([{ id: 'mr-1', createdAt: '2026-01-01T00:00:00Z' }], 'non-existent'), 1);
});

test('formatMrFriendlyId formats number with exclamation prefix', () => {
  assert.equal(formatMrFriendlyId(1), '!1');
  assert.equal(formatMrFriendlyId(42), '!42');
});

test('VirtualMrHub renders friendly MR ID in detail header', async () => {
  const harness = componentHarness();
  const session1 = {
    id: 'vmr-old',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'open',
    title: 'Older MR',
    baseBranch: 'main',
    compareBranch: 'feat-1',
    assignee: { name: 'Alice', email: 'alice@test' },
    reviewers: [],
    labels: [],
    discussions: [],
    commits: [],
  };
  const session2 = {
    id: 'vmr-target',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    status: 'open',
    title: 'Target MR',
    baseBranch: 'main',
    compareBranch: 'feat-2',
    assignee: { name: 'Bob', email: 'bob@test' },
    reviewers: [],
    labels: [],
    discussions: [],
    commits: [],
  };

  const gitStore = {
    currentRepo: { id: 'repo-1' },
    showToast() {},
    diffPayload: null,
    branches: [],
    setBranchComparison() {},
  };

  const mrStore = {
    sessions: [session1, session2],
    getActiveSession: () => session2,
    consumeDescriptionEditRequest: () => false,
    updateSessionDetails: () => {},
    updateSessionBranches: () => {},
    assignReviewerBot: () => {},
    removeReviewerBot: () => {},
    toggleSessionLabel: () => {},
    repoLabels: [],
    activeMrTab: 'overview',
    setActiveMrTab: () => {},
    createDiscussion: () => {},
    openRepoSettings: () => {},
    repoSettings: null,
    refreshRepoMetadata: () => {},
  };

  const botReviewersStore = {
    getEffectiveReviewers: () => ({ reviewers: [] }),
    globalReviewers: [],
    repoActiveBotIds: [],
    repoCustomReviewers: [],
    reloadPersistedReviewers: () => {},
  };

  const reviewStore = {
    activeRuns: new Map(),
    isStarting: false,
    reviewBatches: new Map(),
  };

  const { VirtualMrHub } = loadWithMocks(
    new URL('../frontend/features/virtual-mr/components/VirtualMrHub.tsx', import.meta.url),
    {
      react: harness.react,
      '../../git/store/useGitStore': { useGitStore: () => gitStore },
      '../store/useVirtualMrStore': { useVirtualMrStore: () => mrStore },
      '../../ai/store/useBotReviewersStore': { useBotReviewersStore: () => botReviewersStore },
      '../../review/store/useReviewStore': {
        useReviewStore: (sel) => (sel ? sel(reviewStore) : reviewStore),
        isReviewStartingForSession: () => false,
      },
      '../../review/services/assignedReviewService': {
        startAssignedReviewBatchForSession: () => {},
      },
      '../../../common/components/MarkdownEditor': { MarkdownEditor: () => null },
      '../../../common/components/MarkdownPreview': { MarkdownPreview: () => null },
      '../../git/components/TabBranchSelector': { TabBranchSelector: () => null },
      './MrDiscussionBoard': { MrDiscussionBoard: () => null },
      '../utils/discussionMentions': { getDiscussionMentionOptions: () => [] },
      '../utils/virtualMrActivity': { hasVirtualMrActivity: () => false },
      '../../../common/utils/dateTime': { formatDateTime: (d) => d },
      ...Object.fromEntries(
        ['CheckCircle2', 'XCircle', 'Bot', 'User', 'Plus', 'Edit2', 'Check', 'X', 'FileCode', 'GitCommit', 'MessageSquare', 'RefreshCw', 'ArrowRight', 'Lock']
          .map((icon) => [`../../../common/components/icons/${icon}`, { [icon]: () => null }])
      ),
      '@/common/components/icons': { XCircle: () => null },
      '@/common/utils/dateTime': { formatDateTime: (d) => d },
    }
  );

  const tree = await harness.render(VirtualMrHub, {});
  const nodes = componentNodes(tree);
  const friendlyIdNode = nodes.find((n) => n.props?.title === 'Virtual MR !2');
  assert.ok(friendlyIdNode, 'Friendly MR ID !2 node should be rendered in VirtualMrHub');
  assert.deepEqual(friendlyIdNode.props.children, ['!2']);
});
