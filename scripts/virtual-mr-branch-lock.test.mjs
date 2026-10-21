import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const { create } = require('zustand');

const { hasVirtualMrActivity } = loadWithMocks(
  new URL('../frontend/features/virtual-mr/utils/virtualMrActivity.ts', import.meta.url),
  {}
);

test('hasVirtualMrActivity returns false for freshly created MR with no discussions and pending reviewers', () => {
  const session = {
    id: 'vmr-1',
    repoId: 'repo-1',
    title: 'feature → main',
    description: '',
    baseBranch: 'main',
    compareBranch: 'feature',
    status: 'open',
    assignee: { name: 'User', email: 'user@local' },
    reviewers: [
      { agentId: 'security', agentName: 'Security Bot', reviewStatus: 'pending', assignedAt: '2026-10-21T00:00:00Z' },
      { agentId: 'performance', agentName: 'Performance Bot', reviewStatus: 'pending', assignedAt: '2026-10-21T00:00:00Z' },
    ],
    labels: [],
    discussions: [],
    commits: [],
    isPinned: false,
    createdAt: '2026-10-21T00:00:00Z',
    updatedAt: '2026-10-21T00:00:00Z',
  };

  assert.equal(hasVirtualMrActivity(session), false);
  assert.equal(hasVirtualMrActivity(session, { isReviewOngoing: false }), false);
});

test('hasVirtualMrActivity returns true when any discussion exists', () => {
  const session = {
    id: 'vmr-1',
    status: 'open',
    reviewers: [{ agentId: 'bot-1', reviewStatus: 'pending' }],
    discussions: [
      {
        id: 'disc-1',
        sessionId: 'vmr-1',
        resolved: false,
        comments: [{ id: 'c-1', content: 'Discussion comment' }],
      },
    ],
  };

  assert.equal(hasVirtualMrActivity(session), true);
});

test('hasVirtualMrActivity returns true when any reviewer has acted or is reviewing', () => {
  const baseSession = {
    id: 'vmr-1',
    status: 'open',
    discussions: [],
    reviewers: [{ agentId: 'bot-1', reviewStatus: 'pending' }],
  };

  for (const status of ['reviewing', 'approved', 'changes_requested', 'commented']) {
    const sessionWithStatus = {
      ...baseSession,
      reviewers: [{ agentId: 'bot-1', reviewStatus: status }],
    };
    assert.equal(hasVirtualMrActivity(sessionWithStatus), true, `Expected true for status ${status}`);
  }
});

test('hasVirtualMrActivity returns true when ongoing review is indicated via options', () => {
  const session = {
    id: 'vmr-1',
    status: 'open',
    discussions: [],
    reviewers: [{ agentId: 'bot-1', reviewStatus: 'pending' }],
  };

  assert.equal(hasVirtualMrActivity(session, { isReviewOngoing: true }), true);
});

test('hasVirtualMrActivity returns false safely for null or undefined session', () => {
  assert.equal(hasVirtualMrActivity(null), false);
  assert.equal(hasVirtualMrActivity(undefined), false);
});

test('updateSessionBranches in store allows branch changes when no activity, but locks when discussions or reviews exist', async () => {
  const toasts = [];
  const gitStore = create(() => ({
    currentRepo: { id: 'repo-1', local_path: '/repo' },
    showToast: (msg, type) => toasts.push({ msg, type }),
    setBranchComparison: async () => {},
  }));

  const botReviewersStore = create(() => ({
    globalReviewers: [],
    repoCustomReviewers: {},
  }));

  const { useVirtualMrStore } = loadWithMocks(
    new URL('../frontend/features/virtual-mr/store/useVirtualMrStore.ts', import.meta.url),
    {
      zustand: { create },
      '@tauri-apps/api/core': { invoke: async () => [] },
      '../../git/store/useGitStore': { useGitStore: gitStore },
      '../../ai/store/useBotReviewersStore': { useBotReviewersStore: botReviewersStore },
      '../utils/virtualMrActivity': { hasVirtualMrActivity },
      '../services/sessionPersistence': {
        enqueueSessionWrite: (_id, fn) => fn(),
        saveSessionSnapshot: async () => ({ outcome: 'saved' }),
        pendingSessionSnapshot: () => null,
      },
    }
  );

  const initialSession = {
    id: 'vmr-test',
    repoId: 'repo-1',
    title: 'feature-a → main',
    description: '',
    baseBranch: 'main',
    compareBranch: 'feature-a',
    status: 'open',
    assignee: { name: 'User', email: 'user@local' },
    reviewers: [{ agentId: 'bot-1', agentName: 'Bot', reviewStatus: 'pending' }],
    labels: [],
    discussions: [],
    commits: [],
    isPinned: false,
    createdAt: '2026-10-21T00:00:00Z',
    updatedAt: '2026-10-21T00:00:00Z',
  };

  useVirtualMrStore.setState({
    currentRepoId: 'repo-1',
    currentRepoPath: '/repo',
    sessions: [initialSession],
    activeSessionId: 'vmr-test',
  });

  // 1. Initially no activity: should allow changing branches
  await useVirtualMrStore.getState().updateSessionBranches('vmr-test', 'staging', 'feature-b');
  let current = useVirtualMrStore.getState().sessions.find((s) => s.id === 'vmr-test');
  assert.equal(current.baseBranch, 'staging');
  assert.equal(current.compareBranch, 'feature-b');
  assert.equal(toasts.length, 0);

  // 2. Add a discussion: now branch change should be blocked!
  useVirtualMrStore.setState((state) => ({
    sessions: state.sessions.map((s) =>
      s.id === 'vmr-test'
        ? {
            ...s,
            discussions: [
              {
                id: 'disc-1',
                sessionId: 'vmr-test',
                resolved: false,
                comments: [{ id: 'c-1', content: 'Can we improve this?' }],
              },
            ],
          }
        : s
    ),
  }));

  await useVirtualMrStore.getState().updateSessionBranches('vmr-test', 'production', 'feature-c');
  current = useVirtualMrStore.getState().sessions.find((s) => s.id === 'vmr-test');
  // Must NOT have changed to production / feature-c
  assert.equal(current.baseBranch, 'staging');
  assert.equal(current.compareBranch, 'feature-b');
  assert.ok(toasts.some((t) => t.msg.includes('Cannot change branches') && t.type === 'warning'));

  // 3. Test with review status changed
  toasts.length = 0;
  useVirtualMrStore.setState((state) => ({
    sessions: state.sessions.map((s) =>
      s.id === 'vmr-test'
        ? {
            ...s,
            discussions: [], // clear discussions
            reviewers: [{ agentId: 'bot-1', agentName: 'Bot', reviewStatus: 'approved' }], // review acted
          }
        : s
    ),
  }));

  await useVirtualMrStore.getState().updateSessionBranches('vmr-test', 'production', 'feature-c');
  current = useVirtualMrStore.getState().sessions.find((s) => s.id === 'vmr-test');
  assert.equal(current.baseBranch, 'staging');
  assert.equal(current.compareBranch, 'feature-b');
  assert.ok(toasts.some((t) => t.msg.includes('Cannot change branches') && t.type === 'warning'));
});
