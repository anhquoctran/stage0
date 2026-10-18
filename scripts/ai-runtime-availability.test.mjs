import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadWithMocks, componentHarness, componentNodes } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const { create } = require('zustand');
const availability = loadWithMocks(new URL('../frontend/features/ai/constants/runtimeAvailability.ts', import.meta.url), {});
const normalization = loadWithMocks(new URL('../frontend/features/ai/utils/resetMcpVerification.ts', import.meta.url), {});
const presets = loadWithMocks(new URL('../frontend/features/ai/constants/aiPresets.ts', import.meta.url), {});
const guardrails = loadWithMocks(new URL('../frontend/features/ai/types/guardrails.ts', import.meta.url), {});

function mrStore() {
  const calls = [];
  const { useVirtualMrStore: store } = loadWithMocks(new URL('../frontend/features/virtual-mr/store/useVirtualMrStore.ts', import.meta.url), {
    zustand: { create },
    '@tauri-apps/api/core': { invoke: async (...args) => { calls.push(args); } },
    '../../git/store/useGitStore': { useGitStore: { getState: () => ({}) } },
    '../../ai/store/useBotReviewersStore': { useBotReviewersStore: { getState: () => ({ globalReviewers: [], repoCustomReviewers: {} }) } },
    '../types/virtualMr': { AVAILABLE_AI_BOTS: [], PRESET_REPO_LABELS: [] },
    '../../ai/constants/runtimeAvailability': availability,
  });
  return { store, calls };
}

function session(discussions = []) {
  return { id: 'mr', title: 'Review', status: 'open', baseBranch: 'main', compareBranch: 'feature',
    assignee: { name: 'User', email: 'user@example.test' }, reviewers: [], discussions };
}

test('re-verification never changes state, emits fake comments or auto-approves any session', async () => {
  for (const discussions of [[], [{ id: 'disc', isResolved: false }], [{ id: 'disc', isResolved: true }]]) {
    const { store, calls } = mrStore();
    store.setState({ sessions: [session(discussions)], activeSessionId: 'mr' });
    const before = store.getState().sessions;
    await assert.rejects(store.getState().reverifyDiscussionFix('disc'), /not available yet/);
    await assert.rejects(store.getState().triggerIncrementalReReview('mr'), /not available yet/);
    await assert.rejects(store.getState().triggerIncrementalReReview('missing'), /not available yet/);
    await assert.rejects(store.getState().resolveDiscussion('disc', true, 'ai_verified'), /not available yet/);
    assert.equal(store.getState().sessions, before);
    assert.deepEqual(calls, []);
  }
});

test('manual discussion resolution still works without asserting AI verification', async () => {
  const { store, calls } = mrStore();
  store.setState({ sessions: [session([{ id: 'disc', isResolved: false }])] });
  await store.getState().resolveDiscussion('disc', true);
  assert.equal(store.getState().sessions[0].discussions[0].isResolved, true);
  assert.equal(store.getState().sessions[0].discussions[0].resolveType, 'manual');
  assert.equal(calls[0][0], 'resolve_mr_discussion');
  assert.equal(calls[0][1].resolveType, 'manual');
});

test('review UI does not infer AI execution or approval from discussion/session status', async () => {
  for (const status of ['open', 'approved', 'closed']) {
    const harness = componentHarness();
    const item = { ...session(), status };
    const { VirtualMrBottomBar } = loadWithMocks(new URL('../frontend/features/virtual-mr/components/VirtualMrBottomBar.tsx', import.meta.url), {
      react: harness.react,
      ...Object.fromEntries(['GitPullRequest', 'CheckCircle2', 'RotateCcw', 'Bot', 'AlertCircle', 'RefreshCw', 'ArrowRight'].map((name) => [
        `../../../common/components/icons/${name}`, { [name]: () => null },
      ])),
      '@/common/components/icons': { XCircle: () => null },
      '../store/useVirtualMrStore': { useVirtualMrStore: () => ({ getActiveSession: () => item }) },
      '../../git/store/useGitStore': { useGitStore: () => ({ currentRepo: { id: 'repo' } }) },
      '../../ai/constants/runtimeAvailability': availability,
      '../../review/store/useReviewStore': { useReviewStore: { getState: () => ({ open: () => {} }) } },
    });
    const tree = await harness.render(VirtualMrBottomBar);
    const nodes = componentNodes(tree);
    const text = nodes.flatMap((node) => [node.props?.children].flat(Infinity)).filter((value) => typeof value === 'string').join(' ');
    assert.doesNotMatch(text, /Approved by AI|AI bot review active|verified and approved/);
    const button = nodes.find((node) => node.type === 'button' && node.props.title === 'Open read-only AI review runs; discussions are not auto-resolved');
    if (status !== 'closed') assert.equal(typeof button?.props.onClick, 'function');
    harness.cleanup();
  }
});

function withAiStore(callback, persisted, invokeHandler = () => undefined) {
  const oldWindow = globalThis.window;
  const oldStorage = globalThis.localStorage;
  const saved = new Map(persisted ? [['stage0_ai_mcp_config', JSON.stringify(persisted)]] : []);
  globalThis.window = { setTimeout: () => 0 };
  globalThis.localStorage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: (key) => saved.delete(key) };
  const calls = [];
  const { useAiMcpStore: store } = loadWithMocks(new URL('../frontend/features/ai/store/useAiMcpStore.ts', import.meta.url), {
    zustand: { create },
    '@tauri-apps/api/core': { isTauri: () => true, invoke: async (...args) => { calls.push(args); return invokeHandler(...args); } },
    '../constants/aiPresets': presets,
    '../types/guardrails': guardrails,
    '../constants/runtimeAvailability': availability,
    '../utils/resetMcpVerification': normalization,
  });
  return Promise.resolve().then(() => callback(store, calls, saved)).finally(() => {
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage;
  });
}

test('MCP defaults and restored/imported settings cannot assert a verified connection or discovered tools', async () => {
  assert.ok(presets.DEFAULT_MCP_SERVERS.every((item) => item.testStatus === 'untested' && item.toolsCount === undefined));
  const legacy = { id: 'legacy', name: 'Legacy', type: 'stdio', command: 'fixture-not-run', args: [], env: {}, enabled: true,
    testStatus: 'success', toolsCount: 99, resourcesCount: 10, lastTestedAt: 'yesterday' };
  await withAiStore((store, calls, saved) => {
    const check = (item) => {
      assert.equal(item.testStatus, 'untested');
      assert.equal(item.toolsCount, undefined);
      assert.equal(item.resourcesCount, undefined);
      assert.equal(item.lastTestedAt, undefined);
    };
    check(store.getState().mcpServers[0]);
    store.getState().addMcpServer({ ...legacy, id: undefined });
    store.getState().importMcpConfigFile(JSON.stringify([{ ...legacy, id: 'imported' }]));
    store.getState().updateMcpServer('legacy', { testStatus: 'success', toolsCount: 42 });
    store.getState().mcpServers.forEach(check);
    JSON.parse(saved.get('stage0_ai_mcp_config')).mcpServers.forEach(check);
    assert.deepEqual(calls, []);
  }, { mcpServers: [legacy] });
});

test('local MCP checks report unavailable or invalid without starting a process or contacting a server', async () => {
  await withAiStore(async (store, calls) => {
    for (const item of store.getState().mcpServers) {
      const result = await store.getState().testMcpServer(item.id);
      assert.equal(result.success, false);
      assert.match(result.message, /no server was contacted/i);
      assert.equal(store.getState().mcpServers.find((server) => server.id === item.id).testStatus, 'unavailable');
    }
    store.getState().updateMcpServer('git-context', { command: '' });
    const invalid = await store.getState().testMcpServer('git-context');
    assert.equal(invalid.success, false);
    assert.match(invalid.message, /Invalid local configuration/);
    assert.equal(store.getState().mcpServers[0].testStatus, 'failed');
    assert.deepEqual(calls, []);
  });
});

test('MCP import and export preserve HTTP vs legacy SSE without importing verification authority', async () => {
  await withAiStore((store) => {
    const imported=store.getState().importMcpConfigFile(JSON.stringify({mcpServers:{modern:{type:'http',url:'http://localhost:8000/mcp'},legacy:{type:'sse',url:'http://localhost:8000/sse'}}}));
    assert.equal(imported.success,true);
    assert.equal(store.getState().mcpServers.find((s)=>s.id==='modern').type,'http');
    assert.equal(store.getState().mcpServers.find((s)=>s.id==='legacy').type,'sse');
    const exported=JSON.parse(store.getState().exportMcpConfigFile());
    assert.equal(exported.mcpServers.modern.type,'http'); assert.equal(exported.mcpServers.legacy.type,'sse');
    assert.equal(exported.mcpServers.modern.testStatus,undefined); assert.equal(exported.mcpServers.modern.toolsCount,undefined);
  });
});

test('cloud connectivity reports the actual native function-calling result, not configuration validation', async () => {
  await withAiStore(async (store, calls) => {
    const result = await store.getState().testAiConnection({ ...presets.DEFAULT_AI_CONFIG, provider: 'anthropic', authMode: 'api_key' }, true);
    assert.equal(result.success, true);
    assert.match(result.message, /Verified function calling/);
    assert.equal(calls[0][0], 'test_ai_review_provider');
    assert.equal(calls[0][1].request.instructions, '');
    assert.equal(calls[0][1].request.apiKey, undefined);
    assert.equal(store.getState().isTestingAi, false);
  }, undefined, () => ({ success: true, message: 'Verified function calling. No repository source was sent.' }));
});

test('native connectivity refuses unsaved key drafts instead of silently checking a different saved key', async () => {
  await withAiStore(async (store,calls) => {
    const result=await store.getState().testAiConnection({ ...presets.DEFAULT_AI_CONFIG, provider:'anthropic',authMode:'api_key',apiKey:'fixture-unsaved-key' },true);
    assert.equal(result.success,false); assert.match(result.message,/Apply API key changes/); assert.deepEqual(calls,[]);
  });
});

test('implemented CLI and subscription connectivity paths still report actual successful responses', async () => {
  for (const authMode of ['cli_bridge', 'subscription_oauth']) {
    await withAiStore(async (store, calls) => {
      const result = await store.getState().testAiConnection({
        ...presets.DEFAULT_AI_CONFIG, provider: 'openai', authMode, cliType: 'claude',
      });
      assert.equal(result.success, true);
      assert.equal(calls.length, 1);
      assert.equal(calls[0][0], authMode === 'cli_bridge' ? 'ai_execute_cli' : 'ai_chat_dispatch');
    }, undefined, () => ({ success: true, output: 'Connected', content: 'Connected', duration_ms: 10, provider_used: 'Fixture provider' }));
  }
});

test('backend verification IPC is fail-closed, and metadata templates are not labelled AI generated', () => {
  const source = readFileSync(new URL('../backend/src/features/virtual_mr/commands.rs', import.meta.url), 'utf8');
  const verification = source.slice(source.indexOf('pub async fn verify_mr_discussion('), source.indexOf('pub async fn reanchor_file_discussions('));
  assert.match(verification, /require_review_runtime\(\)/);
  assert.doesNotMatch(verification, /db\.verify_discussion/);
  for (const [start, end] of [
    ['pub async fn create_mr_discussion(', 'pub async fn add_mr_comment('],
    ['pub async fn resolve_mr_discussion(', 'pub async fn verify_mr_discussion('],
  ]) {
    const command = source.slice(source.indexOf(start), source.indexOf(end));
    assert.match(command, /require_review_runtime\(\)\?/);
    assert.ok(command.indexOf('require_review_runtime()') < command.indexOf('app.state::<Database>()'));
  }
  for (const file of ['VirtualMrHub.tsx', 'NewVirtualMrView.tsx']) {
    const component = readFileSync(new URL(`../frontend/features/virtual-mr/components/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(component, /AI generated draft|Generated description with AI/);
    assert.match(component, /onGenerateDraft=/);
  }
});
