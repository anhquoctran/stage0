import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { loadWithMocks, componentHarness, componentNodes } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const { create } = require('zustand');
const config = { provider: 'anthropic', authMode: 'api_key', model: 'fixture-model', baseUrl: 'https://api.anthropic.com/v1', systemPrompt: 'Review', apiKey: 'not-sent-to-ipc' };
function run(id = 'run-a', sessionId = 'a', status = 'running') {
  return { id, sessionId, provider: 'anthropic', model: 'fixture-model', status,
    snapshot: { repoPath: '/fixture', baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40), mergeBaseSha: 'a'.repeat(40), changedFiles: ['file.rs'], excludedFiles: [] },
    findings: [], inspectedFiles: [], turns: 0, toolCalls: 0, usageTokens: 0, contextBytes: 0, startedAt: '2026-10-18T00:00:00Z', finishedAt: null, published: false, summary: '', error: null };
}
function deferred() { let resolve; const promise = new Promise((ok) => { resolve = ok; }); return { promise, resolve }; }
function storeFixture(handler) {
  const calls = []; const refreshed = []; const descriptions = []; const reviewerStatuses = [];
  const sessions = [{ id: 'a', discussions: [] }];
  const { useReviewStore: store } = loadWithMocks(new URL('../frontend/features/review/store/useReviewStore.ts', import.meta.url), {
    zustand: { create },
    '@tauri-apps/api/core': { invoke: async (...args) => { calls.push(args); return handler(...args); } },
    '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: { getState: () => ({
      sessions,
      refreshDiscussions: async (id) => { refreshed.push(id); },
      applyReviewGeneratedDescription: async (...args) => { descriptions.push(args); },
      setReviewerReviewStatus: async (...args) => { reviewerStatuses.push(args); },
      tryResolveSession: async () => {},
    }) } },
    '../services/assignedReviewService': { flushQueuedReReviewAfterActive: async () => {} },
  });
  return { store, calls, refreshed, descriptions, reviewerStatuses, sessions };
}

test('MR review history loads without opening the review panel', async () => {
  const finished = run('run-a', 'a', 'completed');
  const { store } = storeFixture((name) => name === 'list_ai_reviews'
    ? [finished] : { run: finished, events: [] });
  await store.getState().load('a');
  assert.equal(store.getState().isOpen, false);
  assert.equal(store.getState().sessionId, 'a');
  assert.deepEqual(store.getState().runs, [finished]);
  assert.equal(store.getState().detail.run, finished);
});

test('the selected MR tab follows background startup and completion with the panel closed', async () => {
  const started = { ...run(), reviewerId: 'bot-a' };
  const { store, refreshed, reviewerStatuses } = storeFixture((name) => {
    if (name === 'list_ai_reviews') return [];
    if (name === 'start_ai_review') return started;
  });
  await store.getState().load('a');
  await store.getState().startForSession('a', config, true);
  assert.equal(store.getState().detail.run, started);
  assert.deepEqual(store.getState().runs, [started]);
  const finished = { ...started, status: 'completed', decision: 'approve' };
  await store.getState().syncRun({ run: finished, events: [] });
  assert.equal(store.getState().detail.run, finished);
  assert.deepEqual(store.getState().runs, [finished]);
  assert.equal(store.getState().isOpen, false);
  assert.deepEqual(refreshed, ['a']);
  assert.deepEqual(reviewerStatuses, [['a', 'bot-a', 'reviewing'], ['a', 'bot-a', 'approved']]);
});

test('history observes completion before retiring a tracked run and synchronizes exactly once', async () => {
  const finished = { ...run('run-a', 'a', 'completed'), reviewerId: 'bot-a', decision: 'request_changes', generatedDescription: 'Summary' };
  const { store, refreshed, descriptions, reviewerStatuses } = storeFixture((name) => name === 'list_ai_reviews'
    ? [run()] : { run: finished, events: [] });
  store.setState({ activeRuns: { 'run-a': run() } });
  await store.getState().load('a');
  await store.getState().load('a');
  assert.deepEqual(store.getState().activeRuns, {});
  assert.equal(store.getState().runs[0].status, 'completed');
  assert.deepEqual(refreshed, ['a']);
  assert.deepEqual(descriptions, [['a', 'Summary']]);
  assert.deepEqual(reviewerStatuses, [['a', 'bot-a', 'changes_requested']]);
});

test('a slow history response cannot resurrect a review that polling has completed', async () => {
  const pending = deferred();
  const { store } = storeFixture((name) => name === 'list_ai_reviews'
    ? [run()] : pending.promise);
  store.setState({ activeRuns: { 'run-a': run() } });
  const loading = store.getState().load('a');
  await Promise.resolve();
  const finished = run('run-a', 'a', 'completed');
  await store.getState().syncRun({ run: finished, events: [] });
  pending.resolve({ run: run(), events: [] });
  await loading;
  assert.deepEqual(store.getState().activeRuns, {});
  assert.equal(store.getState().runs[0].status, 'completed');
  assert.equal(store.getState().detail.run.status, 'completed');
});

test('switching MR tabs rejects a previous tab history response without opening a panel', async () => {
  const pending = deferred();
  const { store } = storeFixture((name, args) => name === 'list_ai_reviews'
    ? args.sessionId === 'a' ? pending.promise : [run('run-b', 'b', 'completed')]
    : { run: run(args.runId, args.runId === 'run-a' ? 'a' : 'b', 'completed'), events: [] });
  const loading = store.getState().load('a');
  await store.getState().load('b');
  pending.resolve([run()]);
  await loading;
  assert.equal(store.getState().sessionId, 'b');
  assert.equal(store.getState().detail.run.sessionId, 'b');
  assert.equal(store.getState().isOpen, false);
});

test('manual review startup rechecks open code discussions and resumes only after they are resolved', async () => {
  const { store, calls, sessions } = storeFixture(() => run());
  const discussion = { id: 'finding', filePath: 'source.rs', isResolved: false };
  sessions[0].discussions = [discussion];
  store.getState().open('a');
  await store.getState().start(config, true);
  assert.equal(calls.length, 0);
  assert.match(store.getState().error, /Resolve 1 open code discussion/);
  discussion.isResolved = true;
  await store.getState().start(config, true);
  assert.equal(calls.length, 1);
  assert.equal(store.getState().error, null);
});

test('new reviews send only configuration and consent, not plaintext API keys or client-selected refs', async () => {
  const { store, calls } = storeFixture((name) => { assert.equal(name, 'start_ai_review'); return run(); });
  store.getState().open('a'); await store.getState().start(config, true);
  const request = calls[0][1].request;
  assert.equal(request.allowRemote, true); assert.equal(request.authMode, 'api_key');
  assert.equal(request.sessionId, 'a');
  assert.equal(request.generateDescription, true);
  assert.equal(request.apiKey, undefined); assert.equal(request.repoPath, undefined); assert.equal(request.headSha, undefined);
  assert.doesNotMatch(JSON.stringify(request), /not-sent-to-ipc/);
  assert.equal(store.getState().detail.run.id, 'run-a');
});

test('closing during snapshot capture keeps the eventual review tracked in the background', async () => {
  const pending = deferred();
  const { store } = storeFixture(() => pending.promise);
  store.getState().open('a'); const started = store.getState().start(config, true);
  store.getState().close(); pending.resolve(run()); await started;
  assert.equal(store.getState().isOpen, false);
  assert.equal(store.getState().activeRuns['run-a'].status, 'running');
  assert.equal(store.getState().isStarting, false);
});

test('stale history responses cannot replace another session and background completion cannot switch it', async () => {
  const old = deferred();
  const { store } = storeFixture((name, args) => {
    if (name === 'list_ai_reviews') return args.sessionId === 'a' ? old.promise : [run('run-b', 'b', 'completed')];
    return { run: args.runId === 'run-a' ? run('run-a', 'a', 'completed') : run('run-b', 'b', 'completed'), events: [] };
  });
  store.getState().open('a'); const loading = store.getState().load('a');
  store.getState().open('b'); await store.getState().load('b');
  old.resolve([run()]); await loading;
  assert.equal(store.getState().detail.run.sessionId, 'b');
  store.setState({ activeRuns: { 'run-a': run() } });
  await store.getState().syncActive();
  assert.equal(store.getState().detail.run.sessionId, 'b');
  assert.deepEqual(store.getState().activeRuns, {});
  assert.equal(store.getState().lastFinishedRun.id, 'run-a');
});

test('cancel and explicit publish address the correct run and refresh only its discussions', async () => {
  const { store, calls, refreshed } = storeFixture((name) => {
    if (name === 'list_ai_reviews') return [run('run-a', 'a', 'completed')];
    if (name === 'get_ai_review') return { run: { ...run('run-a', 'a', 'completed'), published: true }, events: [] };
  });
  store.getState().open('a'); store.setState({ detail: { run: run(), events: [] } });
  await store.getState().cancel();
  assert.deepEqual(calls[0], ['cancel_ai_review', { runId: 'run-a' }]);
  await store.getState().publish(); assert.deepEqual(refreshed, []);
  store.setState({ detail: { run: run('run-a', 'a', 'completed'), events: [] } });
  await store.getState().publish(); assert.deepEqual(refreshed, ['a']);
  assert.ok(calls.some(([name]) => name === 'publish_ai_review'));
  assert.equal(store.getState().detail.run.published, true);
});

test('provider failures remain errors and cannot manufacture findings or successful runs', async () => {
  const { store } = storeFixture(() => { throw new Error('Fixture provider failure'); });
  store.getState().open('a'); await store.getState().start(config, true);
  assert.match(store.getState().error, /provider failure/);
  assert.equal(store.getState().detail, null); assert.equal(store.getState().isStarting, false);
  assert.deepEqual(store.getState().activeRuns, {});
});

test('a backend-saved description reaches the MR during the run and is not replayed over later user edits', async () => {
  let current = { ...run(), generatedDescription: '## Summary\nSaved by the reviewer.', turns: 4 };
  const { store, descriptions, refreshed } = storeFixture(() => ({ run: current, events: [] }));
  store.setState({ activeRuns: { 'run-a': run() } });
  await store.getState().syncActive();
  assert.deepEqual(descriptions, [['a', current.generatedDescription]]);
  assert.deepEqual(refreshed, []);
  await store.getState().syncActive();
  assert.equal(descriptions.length, 1);
  // A slower poll captured before the description was written cannot regress
  // the tracked run and trigger another application over a user's later edit.
  await store.getState().syncRun({ run: { ...run(), turns: 3 }, events: [] });
  assert.equal(store.getState().activeRuns['run-a'].generatedDescription, current.generatedDescription);
  current = { ...current, status: 'failed', error: 'ACP reviewer must return the required JSON tool-call envelope' };
  await store.getState().syncActive();
  assert.equal(descriptions.length, 1);
  assert.equal(store.getState().lastFinishedRun.status, 'failed');
  assert.equal(store.getState().lastFinishedRun.error, current.error);
  assert.deepEqual(refreshed, ['a']);
});

test('a failed first phase cannot report a generated description or an approved reviewer', async () => {
  const failed = { ...run('run-a', 'a', 'failed'), reviewerId: 'bot-a', error: 'Invalid ACP tool-call envelope' };
  const { store, descriptions, reviewerStatuses } = storeFixture(() => ({ run: failed, events: [] }));
  store.setState({ activeRuns: { 'run-a': run() } });
  await store.getState().syncActive();
  assert.deepEqual(descriptions, []);
  assert.equal(store.getState().lastFinishedRun.status, 'failed');
  assert.deepEqual(reviewerStatuses, [['a', 'bot-a', 'pending']]);
  assert.deepEqual(store.getState().activeRuns, {});
});

function assignedBatchFixture(finished) {
  const started = []; const synchronized = [];
  const session = { id: 'a', repoId: 'repo-a', status: 'open', reviewers: [{ agentId: 'bot-a', agentName: 'Reviewer 01' }] };
  const reviewState = {
    activeRuns: {}, reviewBatches: {},
    setReviewBatch: (id, progress) => { if (progress) reviewState.reviewBatches[id] = progress; else delete reviewState.reviewBatches[id]; },
    startForSession: async (...args) => { started.push(args); return run(); },
    syncRun: async (detail) => { synchronized.push(detail.run); },
  };
  const service = loadWithMocks(new URL('../frontend/features/review/services/assignedReviewService.ts', import.meta.url), {
    '@tauri-apps/api/core': { invoke: async (name) => { assert.equal(name, 'get_ai_review'); return { run: finished, events: [] }; } },
    '../../ai/store/useAiMcpStore': { useAiMcpStore: { getState: () => ({ aiConfig: { provider: 'ollama' }, dynamicModels: {}, externalAgents: [] }) } },
    '../../ai/store/useBotReviewersStore': { useBotReviewersStore: { getState: () => ({ globalReviewers: [{ id: 'bot-a', name: 'Reviewer 01' }], repoCustomReviewers: {} }) } },
    '../utils/resolveReviewBotConfig': { resolveReviewBotConfig: () => ({ provider: 'ollama' }) },
    '../store/useReviewStore': { useReviewStore: { getState: () => reviewState }, isReviewStartingForSession: () => false },
    '../../git/store/useGitStore': { useGitStore: { getState: () => ({ showToast: () => {} }) } },
    '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: { getState: () => ({ sessions: [session], resetReviewerReviews: async () => {} }) } },
  });
  return { service, started, synchronized, reviewState, session };
}

test('discussion replies send thread scope and cannot change frontend MR descriptions or reviewer verdicts', async () => {
  const current = { ...run(), reviewerId: 'bot-a', replyDiscussionId: 'thread' };
  const { store, calls, refreshed, descriptions, reviewerStatuses, sessions } = storeFixture((name) => {
    if (name === 'start_ai_review') return current;
    return { run: { ...current, status: 'completed', decision: 'comment', generatedDescription: 'Must not apply' }, events: [] };
  });
  sessions[0].discussions = [{ id: 'thread', filePath: 'source.rs', isResolved: false }];
  await store.getState().startForSession('a', config, true, { id: 'bot-a', name: 'Bot A' }, false, 'thread');
  assert.equal(calls[0][1].request.replyDiscussionId, 'thread');
  assert.equal(calls[0][1].request.generateDescription, false);
  assert.deepEqual(reviewerStatuses, []);
  await store.getState().syncActive();
  assert.deepEqual(reviewerStatuses, []);
  assert.deepEqual(descriptions, []);
  assert.deepEqual(refreshed, ['a']);
});

test('user discussion comments start bounded replies without a full review batch and deduplicate the same comment', async () => {
  const finished = { ...run('run-a', 'a', 'completed'), replyDiscussionId: 'thread', decision: 'comment' };
  const { service, started, reviewState, session } = assignedBatchFixture(finished);
  session.discussions = [{ id: 'thread', isResolved: false,
    rootComment: { id: 'root', authorType: 'ai_agent', authorId: 'bot-a', body: 'Finding' },
    children: [{ id: 'user', authorType: 'user', authorId: 'alice', body: 'Please explain', updatedAt: 'now' }],
  }];
  await service.queueAssignedDiscussionReply('a', 'thread');
  assert.equal(started.length, 1);
  assert.equal(started[0][4], false);
  assert.equal(started[0][5], 'thread');
  assert.deepEqual(reviewState.reviewBatches, {});
  await service.queueAssignedDiscussionReply('a', 'thread');
  assert.equal(started.length, 1);
  session.discussions[0].children[0].body = 'Edited question, same ID and timestamp';
  await service.queueAssignedDiscussionReply('a', 'thread');
  assert.equal(started.length, 2);
  session.discussions[0].children.push({ id: 'user-2', authorType: 'user', authorId: 'alice', body: 'Another question', updatedAt: 'later' });
  await service.queueAssignedDiscussionReply('a', 'thread');
  assert.equal(started.length, 3);
});

test('provider backoff is synchronized and shown instead of a misleading summarizing status', async () => {
  const retry = { reason: 'rate_limit', httpStatus: 429, attempt: 1, maxAttempts: 2, retryAt: '2026-10-20T15:30:00Z' };
  let current = { ...run(), retry, turns: 10 };
  const { store } = storeFixture(() => ({ run: current, events: [] }));
  store.setState({ activeRuns: { 'run-a': run() } });
  await store.getState().syncActive();
  assert.deepEqual(store.getState().activeRuns['run-a'].retry, retry);

  const harness = componentHarness();
  const originalWindow = globalThis.window;
  globalThis.window = { setInterval: () => 1, clearInterval: () => {} };
  const state = { ...store.getState(), syncActive: async () => {}, reviewBatches: { a: { phase: 'preparing-description', current: 1, total: 1, reviewerName: 'Reviewer 01' } } };
  const { ReviewActivity } = loadWithMocks(new URL('../frontend/features/review/components/ReviewActivity.tsx', import.meta.url), {
    react: harness.react,
    '../store/useReviewStore': { useReviewStore: (selector) => selector(state) },
  });
  try {
    const nodes = componentNodes(await harness.render(ReviewActivity));
    const status = nodes.find((node) => node.props.role === 'status');
    assert.match(status.props.children.flat(Infinity).join(''), /rate limited.*retry 1\/2/);
    assert.match(status.props.title, /HTTP 429.*next retry/);
    current = { ...current, retry: undefined, turns: 11 };
    await store.getState().syncActive();
    assert.equal(store.getState().activeRuns['run-a'].retry, undefined);
  } finally {
    harness.cleanup();
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  }
});

test('assigned batches synchronize the result and report ACP failure without claiming description generation', async () => {
  const failed = { ...run('run-a', 'a', 'failed'), error: 'Invalid ACP tool-call envelope' };
  const { service, started, synchronized, reviewState } = assignedBatchFixture(failed);
  const result = await service.startAssignedReviewBatchForSession('a');
  assert.equal(started[0][4], true);
  assert.equal(result.descriptionGenerated, false);
  assert.equal(result.runs[0].status, 'failed');
  assert.match(result.failures[0], /Invalid ACP/);
  assert.equal(synchronized[0], failed);
  assert.deepEqual(reviewState.reviewBatches, {});
});

test('a later review failure still retains the confirmed description phase in the assigned batch', async () => {
  const failed = { ...run('run-a', 'a', 'failed'), generatedDescription: '## Summary\nSaved before review failed.', error: 'Invalid later ACP response' };
  const { service } = assignedBatchFixture(failed);
  const result = await service.startAssignedReviewBatchForSession('a');
  assert.equal(result.descriptionGenerated, true);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /Invalid later ACP/);
});

test('review panel requires renewed remote consent after changing endpoints and does not cancel on close', async () => {
  const harness = componentHarness(); let started = 0; let closed = 0; let cancelled = 0; let preference;
  const originalDocument = globalThis.document; const originalElement = globalThis.HTMLElement;
  globalThis.document = { activeElement: null }; globalThis.HTMLElement = class {};
  const state = { isOpen: true, sessionId: 'a', runs: [], detail: null, activeRuns: {}, error: null, isStarting: false, isPublishing: false,
    close: () => { closed++; }, load: async () => {}, syncActive: async () => {}, start: async () => { started++; }, cancel: async () => { cancelled++; }, publish: async () => {} };
  const ai = { ...config };
  const { ReviewPanel } = loadWithMocks(new URL('../frontend/features/review/components/ReviewPanel.tsx', import.meta.url), {
    react: harness.react,
    '../../../common/components/icons/X': { X: () => null },
    '../../../common/components/CustomSelect': { CustomSelect: () => null },
    './ReviewFindingCard': { ReviewFindingCard: () => null },
    './HarnessConnectionsPanel': { HarnessConnectionsPanel: () => null },
    '../../../common/utils/dateTime': { formatDateTime: (value) => value },
    '../store/useReviewStore': { useReviewStore: () => state },
    '../../ai/store/useAiMcpStore': { useAiMcpStore: (selector) => selector({ aiConfig: ai }) },
    '../../ai/constants/aiPresets': { AI_PROVIDERS: [{ id: 'anthropic' }] },
    '../../preferences/store/usePreferencesStore': { usePreferencesStore: { getState: () => ({ openPreferences: (tab) => { preference = tab; } }) } },
    '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: (selector) => selector({ sessions: [{ id: 'a', repoId: 'repo-a', reviewers: [] }] }) },
    '../../ai/store/useBotReviewersStore': { useBotReviewersStore: (selector) => selector({ globalReviewers: [], repoCustomReviewers: {} }) },
  });
  try {
    const nodes = async () => componentNodes(await harness.render(ReviewPanel));
    const startButton = (items) => items.find((item) => item.type === 'button' && item.props.children.flat(Infinity).includes('Start new review'));
    let items = await nodes(); assert.equal(startButton(items).props.disabled, true);
    items.find((item) => item.type === 'input').props.onChange({ target: { checked: true } });
    items = await nodes(); assert.equal(startButton(items).props.disabled, false);
    await startButton(items).props.onClick(); assert.equal(started, 1);
    ai.baseUrl = 'https://changed.example/v1'; items = await nodes(); assert.equal(startButton(items).props.disabled, true);
    items.find((item) => item.type === 'button' && item.props['aria-label'] === 'Close review panel').props.onClick();
    assert.equal(closed, 1); assert.equal(cancelled, 0);
    items.find((item) => item.type === 'button' && item.props.children.flat(Infinity).includes('AI Preferences')).props.onClick();
    assert.equal(preference, 'ai-providers');
  } finally {
    harness.cleanup();
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
    if (originalElement === undefined) delete globalThis.HTMLElement; else globalThis.HTMLElement = originalElement;
  }
});
