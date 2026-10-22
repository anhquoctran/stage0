import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';
import { checkFrontendSize } from './check-frontend-size.mjs';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const zustand = require('zustand');
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('frontend budget counts physical lines, nested files, comments, blanks and CRLF', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage0-frontend-budget-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'frontend', 'nested'), { recursive: true });
  fs.writeFileSync(path.join(root, 'frontend', 'at-limit.ts'), '// comment\r\n'.repeat(450));
  fs.writeFileSync(path.join(root, 'frontend', 'nested', 'too-big.tsx'), '\n'.repeat(451));
  fs.writeFileSync(path.join(root, 'frontend', 'ignored.md'), '\n'.repeat(900));
  const result = checkFrontendSize(root);
  assert.equal(result.files, 2);
  assert.equal(result.largest, 451);
  assert.deepEqual(result.violations, [{ file: 'frontend/nested/too-big.tsx', lines: 451 }]);
});

function gitFixture(invoke) {
  const { useGitStore: store } = loadWithMocks(new URL('../frontend/features/git/store/useGitStore.ts', import.meta.url), {
    zustand,
    '@tauri-apps/api/core': { invoke },
  });
  store.setState({ currentRepo: { id: 'repo', name: 'Repo', local_path: '/fixture' }, baseBranch: 'main', compareBranch: 'feature' });
  return store;
}

test('repository lifecycle and diff slices share invalidation: close discards pending results', async () => {
  const response = deferred();
  const calls = [];
  const store = gitFixture(async (command) => {
    calls.push(command);
    if (command === 'get_mr_diff') return response.promise;
    if (command === 'close_repository_window') return;
    assert.fail(`Unexpected command ${command}`);
  });
  const loading = store.getState().loadDiff();
  await store.getState().closeRepo();
  response.resolve({ files: [{ path: 'old.ts' }] });
  await loading;
  assert.equal(store.getState().currentRepo, null);
  assert.equal(store.getState().diffPayload, null);
  assert.equal(store.getState().selectedFile, null);
  assert.equal(store.getState().isDiffLoading, false);
  assert.deepEqual(calls, ['get_mr_diff', 'close_repository_window']);
});

test('the latest diff wins even for identical refs; conflict checks retain their order', async () => {
  const first = deferred(), second = deferred();
  let requests = 0;
  const calls = [];
  const store = gitFixture(async (command) => {
    calls.push(command);
    if (command === 'get_mr_diff') return ++requests === 1 ? first.promise : second.promise;
    if (command === 'check_merge_conflicts') return { conflicts: [] };
    if (command === 'check_rebase_status') return false;
    assert.fail(`Unexpected command ${command}`);
  });
  const old = store.getState().loadDiff(), latest = store.getState().loadDiff();
  second.resolve({ files: [{ path: 'latest.ts' }] });
  await latest;
  first.resolve({ files: [{ path: 'stale.ts' }] });
  await old;
  assert.equal(store.getState().selectedFile.path, 'latest.ts');
  assert.equal(store.getState().isDiffLoading, false);
  assert.deepEqual(calls, ['get_mr_diff', 'get_mr_diff', 'check_merge_conflicts', 'check_rebase_status']);
});

test('AI persistence strips API keys and refuses plaintext MCP environment secrets', () => {
  const originalWindow = globalThis.window;
  const patches = [];
  globalThis.window = {};
  try {
    const { persistState } = loadWithMocks(new URL('../frontend/features/ai/services/aiMcpPersistence.ts', import.meta.url), {
      '../../preferences/services/preferencesJsonService': { preferencesJsonService: { patch: async (value) => patches.push(value) } },
    });
    persistState({ provider: 'openai', apiKey: 'sk-private', model: 'chosen' }, [], undefined, []);
    assert.equal(patches.length, 1);
    assert.equal('apiKey' in patches[0].ai.aiConfig, false);
    assert.equal(patches[0].ai.aiConfig.model, 'chosen');
    assert.deepEqual(patches[0].ai.aiConfig.authMode, { $stage0Delete: true });
    persistState({ apiKey: '' }, [{ name: 'unsafe', env: { GITHUB_TOKEN: 'ghp_private' } }]);
    assert.equal(patches.length, 1);
    assert.equal(JSON.stringify(patches).includes('sk-private'), false);
    assert.equal(JSON.stringify(patches).includes('ghp_private'), false);
  } finally { globalThis.window = originalWindow; }
});
