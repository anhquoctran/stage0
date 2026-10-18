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
  const calls = []; const refreshed = [];
  const { useReviewStore: store } = loadWithMocks(new URL('../frontend/features/review/store/useReviewStore.ts', import.meta.url), {
    zustand: { create },
    '@tauri-apps/api/core': { invoke: async (...args) => { calls.push(args); return handler(...args); } },
    '../../virtual-mr/store/useVirtualMrStore': { useVirtualMrStore: { getState: () => ({ refreshDiscussions: async (id) => { refreshed.push(id); } }) } },
  });
  return { store, calls, refreshed };
}

test('new reviews send only configuration and consent, not plaintext API keys or client-selected refs', async () => {
  const { store, calls } = storeFixture((name) => { assert.equal(name, 'start_ai_review'); return run(); });
  store.getState().open('a'); await store.getState().start(config, true);
  const request = calls[0][1].request;
  assert.equal(request.allowRemote, true); assert.equal(request.authMode, 'api_key');
  assert.equal(request.sessionId, 'a');
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
    '../../preferences/store/usePreferencesStore': { usePreferencesStore: { getState: () => ({ openPreferences: (tab) => { preference = tab; } }) } },
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
