import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const { create } = require('zustand');
const { fromDbDiscussion } = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/fromDbDiscussion.ts', import.meta.url), {});
const { hasVirtualMrActivity } = loadWithMocks(new URL('../frontend/features/virtual-mr/utils/virtualMrActivity.ts', import.meta.url), {});
const labels = [
  { id: 'bug', repo_id: 'repo-a', name: 'Bug', color: '#ff0000' },
  { id: 'feature', repo_id: 'repo-a', name: 'Feature', color: '#0000ff' },
];

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function row() {
  return {
    id: 'mr', repo_id: 'repo-a', title: 'Fixture MR', description: '',
    base_branch: 'main', compare_branch: 'feature', status: 'open',
    assignee_name: 'User', assignee_email: 'user@example.test', is_pinned: false,
    sandbox_adapter_type: 'in_memory', sandbox_instance_id: null,
    created_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:00Z',
    label_ids: [], reviewers: [],
  };
}

async function fixture(beforeSave = async () => {}) {
  const records = new Map([['mr', row()]]);
  const writes = [];
  const calls = [];
  const toasts = [];
  let activeWrites = 0;
  let maxActiveWrites = 0;
  const invoke = async (command, args) => {
    calls.push([command, args]);
    if (command === 'save_virtual_mr_session') {
      const payload = structuredClone(args.session);
      writes.push(payload);
      const duplicate = payload.status === 'open'
        ? [...records.values()].find((item) => item.id !== payload.id
          && item.repo_id === payload.repo_id
          && item.compare_branch === payload.compare_branch
          && item.base_branch === payload.base_branch
          && item.status === 'open')
        : null;
      if (duplicate) return {
        outcome: 'duplicate_open',
        existing_id: duplicate.id,
        existing_title: duplicate.title,
        base_branch: payload.base_branch,
        compare_branch: payload.compare_branch,
      };
      activeWrites++;
      maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
      try {
        await beforeSave(payload, writes.length);
        records.set(payload.id, payload);
      } finally { activeWrites--; }
      return { outcome: 'saved' };
    }
    if (command === 'delete_virtual_mr_session') { records.delete(args.sessionId); return; }
    if (command === 'list_virtual_mr_sessions') {
      return structuredClone([...records.values()].filter((item) => item.repo_id === args.repoId));
    }
    if (command === 'list_repo_labels') return labels.filter((label) => label.repo_id === args.repoId);
    if (command === 'get_repo_settings') return null;
    if (command === 'get_git_user_identity_cmd') return ['User', 'user@example.test'];
    return [];
  };
  const persistence = loadWithMocks(new URL('../frontend/features/virtual-mr/services/sessionPersistence.ts', import.meta.url), {
    '@tauri-apps/api/core': { invoke },
  });
  const { useVirtualMrStore: store } = loadWithMocks(new URL('../frontend/features/virtual-mr/store/useVirtualMrStore.ts', import.meta.url), {
    zustand: { create },
    '@tauri-apps/api/core': { invoke },
    '../../git/store/useGitStore': { useGitStore: { getState: () => ({
      showToast: (message) => toasts.push(message), setBranchComparison: async () => {},
    }) } },
    '../../ai/store/useBotReviewersStore': { useBotReviewersStore: { getState: () => ({
      globalReviewers: [{ id: 'bot-1', name: 'Reviewer 01' }, { id: 'bot-2', name: 'Reviewer 02' }],
      repoCustomReviewers: {},
    }) } },
    '../../review/services/assignedReviewService': { reReviewAssignedSession: async () => {}, queueAssignedDiscussionReply: async () => {} },
    '../types/virtualMr': { AVAILABLE_AI_BOTS: [], PRESET_REPO_LABELS: [] },
    '../../ai/constants/runtimeAvailability': {},
    '../utils/fromDbDiscussion': { fromDbDiscussion },
    '../utils/virtualMrActivity': { hasVirtualMrActivity },
    '../services/sessionPersistence': persistence,
  });
  const reload = () => store.getState().loadRepoData('repo-a', '/fixture/a', ['main', 'feature']);
  await reload();
  return { store, records, writes, calls, toasts, reload, maxWrites: () => maxActiveWrites };
}

test('reviewer and label additions/removals persist and reload with assignment identity', async () => {
  const { store, records, reload, calls } = await fixture();
  await store.getState().assignReviewerBot('mr', 'bot-1');
  await store.getState().toggleSessionLabel('mr', 'bug');
  assert.equal(records.get('mr').reviewers[0].agent_id, 'bot-1');
  assert.equal(records.get('mr').reviewers[0].agent_name, 'Reviewer 01');
  assert.equal(records.get('mr').reviewers[0].review_status, 'pending');
  const assignedAt = records.get('mr').reviewers[0].assigned_at;
  assert.ok(assignedAt);
  await reload();
  let session = store.getState().sessions[0];
  assert.deepEqual(session.reviewers, [{
    agentId: 'bot-1', agentName: 'Reviewer 01', reviewStatus: 'pending', assignedAt,
  }]);
  assert.deepEqual(session.labels.map((label) => label.id), ['bug']);
  await store.getState().removeReviewerBot('mr', 'bot-1');
  await store.getState().toggleSessionLabel('mr', 'bug');
  await reload();
  session = store.getState().sessions[0];
  assert.deepEqual(session.reviewers, []);
  assert.deepEqual(session.labels, []);
  assert.ok(!calls.some(([command]) => /start_ai_review|approve/.test(command)));
});

test('a review description already saved by the backend updates the editor without re-saving stale MR metadata', async () => {
  const { store, records, writes, reload } = await fixture();
  const description = '## Summary\nGenerated from the complete diff.';
  records.get('mr').description = description;
  await store.getState().applyReviewGeneratedDescription('mr', description);
  assert.equal(store.getState().sessions[0].description, description);
  assert.equal(writes.length, 0);
  await reload();
  assert.equal(store.getState().sessions[0].description, description);
});

test('draft selections and later title/status/branch edits retain the saved metadata', async () => {
  const { store, records, reload } = await fixture();
  store.setState({ draftMr: {
    title: 'New fixture MR', description: 'Description', baseBranch: 'main', compareBranch: 'feature-new',
    selectedBots: ['bot-2'], selectedLabels: ['feature'], commits: [],
    isCommitsLoading: false, commitsError: null,
  } });
  const id = await store.getState().submitNewMrDraft();
  assert.ok(id);
  assert.equal(records.get(id).reviewers[0].agent_id, 'bot-2');
  await store.getState().updateSessionDetails(id, 'Edited title', 'Edited description');
  await store.getState().updateSessionStatus(id, 'closed');
  await store.getState().updateSessionBranches(id, 'main', 'other-feature');
  await reload();
  const loaded = store.getState().sessions.find((session) => session.id === id);
  assert.equal(loaded.reviewers[0].agentId, 'bot-2');
  assert.deepEqual(loaded.labels.map((label) => label.id), ['feature']);
  assert.equal(loaded.status, 'closed');
  assert.equal(loaded.compareBranch, 'other-feature');
});

test('submitting a duplicate open source-target pair opens the existing MR instead', async () => {
  const { store, records, toasts, calls } = await fixture();
  store.setState({
    draftMr: {
      title: 'Duplicate fixture MR', description: 'This must not be saved',
      baseBranch: 'main', compareBranch: 'feature', selectedBots: ['bot-1'],
      selectedLabels: ['bug'], commits: [], isCommitsLoading: false, commitsError: null,
    },
    isDraftActive: true,
  });

  const id = await store.getState().submitNewMrDraft();

  assert.equal(id, '');
  assert.equal(records.size, 1);
  assert.equal(records.has('mr'), true);
  assert.equal(store.getState().activeSessionId, 'mr');
  assert.equal(store.getState().isDraftActive, false);
  assert.equal(toasts.at(-1), 'An open Virtual MR already exists for feature → main. Opened “Fixture MR” instead.');
  assert.ok(!calls.some(([command]) => /start_ai_review|approve/.test(command)));
});

test('rapid selections save in order and an overlapping title edit cannot erase them', async () => {
  const gate = deferred();
  const started = deferred();
  const { store, records, reload, maxWrites } = await fixture(async (_payload, count) => {
    if (count === 1) { started.resolve(); await gate.promise; }
  });
  const assign = store.getState().assignReviewerBot('mr', 'bot-1');
  await started.promise;
  const title = store.getState().updateSessionDetails('mr', 'Edited during save', 'Keep this');
  const changes = [
    store.getState().assignReviewerBot('mr', 'bot-2'),
    store.getState().toggleSessionLabel('mr', 'bug'),
    store.getState().toggleSessionLabel('mr', 'feature'),
    store.getState().toggleSessionLabel('mr', 'bug'),
  ];
  gate.resolve();
  await Promise.all([assign, title, ...changes]);
  assert.equal(maxWrites(), 1);
  assert.equal(records.get('mr').title, 'Edited during save');
  await reload();
  const loaded = store.getState().sessions[0];
  assert.deepEqual(loaded.reviewers.map((reviewer) => reviewer.agentId), ['bot-1', 'bot-2']);
  assert.deepEqual(loaded.labels.map((label) => label.id), ['feature']);
  assert.equal(loaded.description, 'Keep this');
});

test('failed saves keep the previous selection, report failure and do not block later writes', async (t) => {
  t.mock.method(console, 'error', () => {});
  const { store, records, toasts, reload } = await fixture(async (_payload, count) => {
    if (count === 1) throw new Error('Fixture disk failure');
  });
  const failed = store.getState().assignReviewerBot('mr', 'bot-1');
  const next = store.getState().toggleSessionLabel('mr', 'bug');
  await Promise.all([failed, next]);
  assert.deepEqual(store.getState().sessions[0].reviewers, []);
  assert.deepEqual(records.get('mr').reviewers, []);
  assert.match(toasts[0], /Could not save/);
  await reload();
  assert.deepEqual(store.getState().sessions[0].labels.map((label) => label.id), ['bug']);
});

test('switching repositories flushes queued selections without replacing the new repository state', async () => {
  const gate = deferred();
  const started = deferred();
  const { store, reload } = await fixture(async (_payload, count) => {
    if (count === 1) { started.resolve(); await gate.promise; }
  });
  const assign = store.getState().assignReviewerBot('mr', 'bot-1');
  const label = store.getState().toggleSessionLabel('mr', 'bug');
  await started.promise;
  const switched = store.getState().loadRepoData('repo-b', '/fixture/b', ['main']);
  gate.resolve();
  await Promise.all([assign, label, switched]);
  assert.equal(store.getState().currentRepoId, 'repo-b');
  assert.deepEqual(store.getState().sessions, []);
  await reload();
  assert.equal(store.getState().sessions[0].reviewers[0].agentId, 'bot-1');
  assert.deepEqual(store.getState().sessions[0].labels.map((item) => item.id), ['bug']);
});

test('closing an MR workspace tab during a queued selection keeps the saved MR', async () => {
  const gate = deferred();
  const started = deferred();
  const { store, records, reload } = await fixture(async (_payload, count) => {
    if (count === 1) { started.resolve(); await gate.promise; }
  });
  const assign = store.getState().assignReviewerBot('mr', 'bot-1');
  await started.promise;
  const closed = store.getState().closeSession('mr');
  gate.resolve();
  await Promise.all([assign, closed]);
  assert.equal(records.has('mr'), true);
  await reload();
  assert.equal(store.getState().sessions[0].id, 'mr');
  assert.equal(store.getState().sessions[0].reviewers[0].agentId, 'bot-1');
});


test('updateSessionDetails tracks title history when title changes', async () => {
  const { store } = await fixture();
  const storage = new Map();
  const mockLocalStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: (key) => storage.delete(key),
    clear: () => storage.clear(),
  };
  globalThis.localStorage = mockLocalStorage;
  try {
    const session = store.getState().sessions[0];
    assert.equal(session.title, 'Fixture MR');

    await store.getState().updateSessionDetails(session.id, 'New Title 1', session.description);
    const updated = store.getState().sessions.find((s) => s.id === session.id);
    assert.equal(updated.title, 'New Title 1');
    assert.equal(updated.titleHistory.length, 1);
    assert.equal(updated.titleHistory[0].oldTitle, 'Fixture MR');
    assert.equal(updated.titleHistory[0].newTitle, 'New Title 1');

    // Updating without changing title should not append to history
    await store.getState().updateSessionDetails(session.id, 'New Title 1', 'New Description');
    const updated2 = store.getState().sessions.find((s) => s.id === session.id);
    assert.equal(updated2.titleHistory.length, 1);

    // Updating title again should append to history
    await store.getState().updateSessionDetails(session.id, 'New Title 2', 'New Description');
    const updated3 = store.getState().sessions.find((s) => s.id === session.id);
    assert.equal(updated3.titleHistory.length, 2);
    assert.equal(updated3.titleHistory[1].oldTitle, 'New Title 1');
    assert.equal(updated3.titleHistory[1].newTitle, 'New Title 2');
  } finally {
    delete globalThis.localStorage;
  }
});
