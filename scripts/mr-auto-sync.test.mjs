import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const { createMrSyncController } = loadWithMocks(new URL('../frontend/features/virtual-mr/services/createMrSyncController.ts', import.meta.url), {});
const pause = () => new Promise(resolve => setTimeout(resolve, 200));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const revision = (sessionId = 'one', n = 1, extra = {}) => ({ sessionId, repoId: 'repo',
  baseBranch: 'main', compareBranch: sessionId, baseSha: 'base', headSha: `head-${n}`,
  revision: n, needsReview: true, refStatus: 'ready', sessionStatus: 'open', reviewers: { bot: 'pending' }, ...extra });
const commit = hash => ({ hash, short_hash: hash, subject: hash, body: '', author_name: 'Fixture', author_email: 'fixture@test', authored_date: 'now' });
function fixture(t, overrides = {}) {
  let state = { currentRepoId: 'repo', currentRepoPath: '/repo', activeSessionId: 'one', isDraftActive: false,
    sessions: ['one', 'two'].map(id => ({ id, repoId: 'repo', baseBranch: 'main', compareBranch: id,
      title: 'Unsaved title', description: 'Keep user text', status: 'resolved', reviewers: [{ agentId: 'bot', reviewStatus: 'approved' }], commits: [] })) };
  const reads = [], diffs = [];
  const store = { getState: () => state, setState: value => { state = { ...state, ...(typeof value === 'function' ? value(state) : value) }; } };
  const controller = createMrSyncController({ store,
    service: { readMrSync: async () => [], ...overrides.service },
    getCommits: async input => { reads.push(input); return overrides.getCommits ? overrides.getCommits(input) : [commit(input.compare)]; },
    refreshDiff: async () => { diffs.push(true); },
  });
  t.after(controller.dispose);
  return { controller, store, reads, diffs };
}

test('background MR updates preserve user metadata and never fetch their diffs or commits', async t => {
  const f = fixture(t);
  f.controller.receive([revision('two'), revision('one', 1, { repoId: 'another' })]);
  await pause();
  assert.equal(f.reads.length, 0); assert.equal(f.diffs.length, 0);
  const two = f.store.getState().sessions[1];
  assert.equal(two.status, 'open'); assert.equal(two.reviewers[0].reviewStatus, 'pending');
  assert.equal(two.title, 'Unsaved title'); assert.equal(two.description, 'Keep user text');
  assert.equal(f.store.getState().sessions[0].sync, undefined);
});

test('commit storms coalesce to one foreground refresh using the newest immutable SHA pair', async t => {
  const f = fixture(t);
  for (let n = 1; n <= 500; n++) f.controller.receive([revision('one', n)]);
  await pause();
  assert.deepEqual(f.reads, [{ repoPath: '/repo', base: 'base', compare: 'head-500' }]);
  assert.equal(f.diffs.length, 1);
  assert.equal(f.store.getState().sessions[0].commits[0].hash, 'head-500');
  f.controller.receive([revision('one', 499)]);
  await pause();
  assert.equal(f.reads.length, 1); assert.equal(f.store.getState().sessions[0].sync.revision, 500);
});

test('a change during an inflight refresh discards obsolete commits and schedules only the latest revision', async t => {
  const first = deferred(), second = deferred();
  const f = fixture(t, { getCommits: input => input.compare === 'head-1' ? first.promise : second.promise });
  f.controller.receive([revision()]); await pause();
  f.controller.receive([revision('one', 2)]); f.controller.receive([revision('one', 3)]);
  first.resolve([commit('obsolete')]); await pause();
  assert.equal(f.reads.length, 2); assert.equal(f.reads[1].compare, 'head-3');
  assert.deepEqual(f.store.getState().sessions[0].commits, []);
  second.resolve([commit('current')]); await new Promise(setImmediate);
  assert.equal(f.store.getState().sessions[0].commits[0].hash, 'current');
});

test('late hydration cannot overwrite an event or a newly selected repository', async t => {
  const pending = deferred(); const f = fixture(t, { service: { readMrSync: () => pending.promise } });
  const hydration = f.controller.hydrate('repo');
  f.controller.receive([revision('two', 10)]);
  pending.resolve([revision('two', 1), revision('one', 2)]); await hydration; await pause();
  assert.equal(f.store.getState().sessions[1].sync.revision, 10);
  assert.equal(f.store.getState().sessions[0].sync.revision, 2, 'An unrelated event must not discard the rest of the hydration snapshot');
  const pending2 = deferred(); const g = fixture(t, { service: { readMrSync: () => pending2.promise } });
  const other = g.controller.hydrate('repo'); g.store.setState({ currentRepoId: 'other' });
  pending2.resolve([revision('two', 20)]); await other;
  assert.equal(g.store.getState().sessions[1].sync, undefined);
});

test('selection loads a background revision lazily and metadata-only updates do not reload source', async t => {
  const f = fixture(t); f.controller.receive([revision('two')]);
  f.store.setState({ activeSessionId: 'two' }); f.controller.selected(); await pause();
  assert.equal(f.reads.length, 1); assert.equal(f.reads[0].compare, 'head-1');
  f.controller.receive([revision('two', 2, { headSha: 'head-1', needsReview: false, sessionStatus: 'resolved' })]); await pause();
  assert.equal(f.reads.length, 1); assert.equal(f.store.getState().sessions[1].sync.needsReview, false);
});

test('removed refs and closed windows do not launch source reads or apply pending work', async t => {
  const f = fixture(t); f.controller.receive([revision('one', 1, { refStatus: 'unavailable', headSha: null })]); await pause();
  assert.equal(f.reads.length, 0);
  f.controller.receive([revision('one', 2)]); f.controller.dispose(); await pause();
  assert.equal(f.reads.length, 0);
  f.controller.receive([revision('one', 3)]); assert.equal(f.store.getState().sessions[0].sync.revision, 1);
});

test('reloading the selected session does not retain a source cache for replaced commits', async t => {
  const f = fixture(t); f.controller.receive([revision()]); await pause();
  assert.equal(f.reads.length, 1);
  f.store.setState({ sessions: f.store.getState().sessions.map(s => ({ ...s, sync: undefined, commits: [] })) });
  f.controller.selected(); f.controller.receive([revision()]); await pause();
  assert.equal(f.reads.length, 2);
  assert.equal(f.store.getState().sessions[0].commits[0].hash, 'head-1');
});


test('lightweight synchronization reuses the existing session IPC without changing ordinary listing', async () => {
  const { createVirtualMrService } = loadWithMocks(new URL('../frontend/features/virtual-mr/services/transport/createVirtualMrService.ts', import.meta.url), {});
  const calls = [], result = [];
  const service = createVirtualMrService({ executeCommand: async (...args) => { calls.push(args); return result; } });
  assert.equal(await service.listVirtualMrSessions({ repoId: 'repo' }), result);
  assert.equal(await service.readMrSync({ repoId: 'repo', syncOnly: true, requestSync: true }), result);
  assert.deepEqual(calls, [
    ['list_virtual_mr_sessions', { repoId: 'repo' }],
    ['list_virtual_mr_sessions', { repoId: 'repo', syncOnly: true, requestSync: true }],
  ]);
});


test('the window runtime waits for events, coalesces focus refreshes and disposes late subscriptions', async t => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  let cleanupRuntime = () => {};
  globalThis.window = new EventTarget(); globalThis.document = new EventTarget();
  Object.defineProperty(globalThis.document, 'visibilityState', { value: 'visible' });
  t.after(() => { cleanupRuntime(); globalThis.window = previousWindow; globalThis.document = previousDocument; });
  let state = { currentRepoId: 'repo', activeSessionId: null, isDraftActive: false, sessions: [] };
  const listeners = new Set(), reads = []; let stopped = 0;
  const store = { getState: () => state, subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    setState: update => { state = { ...state, ...update }; for (const fn of listeners) fn(); } };
  const { installMrSyncRuntime } = loadWithMocks(new URL('../frontend/features/virtual-mr/services/mrSyncRuntime.ts', import.meta.url), {
    '../store/useVirtualMrStore': { useVirtualMrStore: store },
    '../../git/store/useGitStore': { useGitStore: { getState: () => ({ refreshDiff: async () => {} }) } },
  });
  const registration = deferred();
  const services = { platform: { capabilities: { backend: true, events: true }, events: { subscribe: () => registration.promise } },
    virtualMrs: { readMrSync: async input => { reads.push(input); return []; } }, gitHistory: { getCommitsBetweenRefs: async () => [] } };
  const dispose = installMrSyncRuntime(services); cleanupRuntime = dispose;
  assert.equal(reads.length, 0);
  registration.resolve(() => { stopped++; }); await new Promise(setImmediate);
  assert.deepEqual(reads, [{ repoId: 'repo', syncOnly: true, requestSync: true }]);
  window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(reads.length, 1);
  store.setState({ currentRepoId: 'other' }); assert.equal(reads.length, 2);
  dispose(); dispose(); assert.equal(stopped, 1); assert.equal(listeners.size, 0);
  window.dispatchEvent(new Event('focus')); assert.equal(reads.length, 2);
  const late = deferred(); services.platform.events.subscribe = () => late.promise;
  const disposeLate = installMrSyncRuntime(services); disposeLate();
  late.resolve(() => { stopped++; }); await new Promise(setImmediate);
  assert.equal(stopped, 2); assert.equal(reads.length, 2);
});
