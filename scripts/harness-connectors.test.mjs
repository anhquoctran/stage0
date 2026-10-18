import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { loadWithMocks, componentHarness, componentNodes } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const { create } = require('zustand');
const keys = loadWithMocks(new URL('../frontend/features/review/utils/mcpConnectionKey.ts', import.meta.url), {});
const connection = (overrides = {}) => ({ id: 'external', name: 'Fixture server', type: 'http', url: 'http://localhost:8000/mcp', enabled: true, command: 'never-started', args: ['secret-argument'], cwd: '/private/repo', env: { API_TOKEN: 'fixture-not-for-ipc' }, ...overrides });
const report = (overrides = {}) => ({ connectionId: 'external', endpointFingerprint: 'endpoint-hash', catalogFingerprint: 'catalog-hash', protocolVersion: '2025-11-25', serverName: 'Fixture', serverVersion: '1', tools: [], discoveredAt: '2026-10-18T00:00:00Z', attachedToHarness: false, ...overrides });
function deferred() { let resolve; const promise = new Promise((ok) => { resolve = ok; }); return { promise, resolve }; }
function fixture(handler = () => report(), native = true) {
  const calls = []; const config = { mcpServers: [connection()] };
  const { useHarnessConnectionStore: store } = loadWithMocks(new URL('../frontend/features/review/store/useHarnessConnectionStore.ts', import.meta.url), {
    zustand: { create },
    '@tauri-apps/api/core': { isTauri: () => native, invoke: async (...args) => { calls.push(args); return handler(...args); } },
    '../../ai/store/useAiMcpStore': { useAiMcpStore: { getState: () => config } },
    '../utils/mcpConnectionKey': keys,
  });
  return { store, calls, config };
}

test('external connectors never connect on creation and discovery needs explicit one-shot consent', async () => {
  const { store, calls } = fixture(); assert.deepEqual(calls, []);
  await store.getState().discover(connection(), false);
  assert.deepEqual(calls, []); assert.match(store.getState().mcp.external.error, /consent/);
  for (const type of ['stdio', 'sse']) await store.getState().discover(connection({ type }), true);
  assert.deepEqual(calls, []); assert.match(store.getState().mcp.external.error, /not launched/);
});

test('HTTP discovery sends only endpoint identity and consent, never source, environment or launch parameters', async () => {
  const { store, calls } = fixture();
  await store.getState().discover(connection(), true);
  assert.deepEqual(calls, [['discover_harness_mcp', { request: { connectionId: 'external', url: 'http://localhost:8000/mcp', allowNetwork: true } }]]);
  assert.doesNotMatch(JSON.stringify(calls), /fixture-not-for-ipc|private\/repo|secret-argument/);
  assert.equal(store.getState().mcp.external.status, 'discovered');
  assert.equal(store.getState().mcp.external.report.attachedToHarness, false);
});

test('editing or deleting a connection discards late discovery results and releases stale loading state', async () => {
  for (const remove of [false, true]) {
    const pending = deferred(); const { store, config } = fixture(() => pending.promise);
    const loading = store.getState().discover(connection(), true);
    if (remove) config.mcpServers = []; else config.mcpServers[0].url = 'http://localhost:9000/mcp';
    pending.resolve(report()); await loading;
    assert.equal(store.getState().mcp.external, undefined);
  }
});

test('old discovery cannot overwrite the latest endpoint attempt and repeated same-endpoint clicks deduplicate', async () => {
  const old = deferred(); let count = 0;
  const { store, config, calls } = fixture(() => ++count === 1 ? old.promise : report({ catalogFingerprint: 'new' }));
  const pending = store.getState().discover(connection(), true);
  await store.getState().discover(connection(), true); assert.equal(calls.length, 1);
  config.mcpServers = [connection({ url: 'http://localhost:9000/mcp' })];
  await store.getState().discover(config.mcpServers[0], true);
  old.resolve(report({ catalogFingerprint: 'old' })); await pending;
  assert.equal(store.getState().mcp.external.report.catalogFingerprint, 'new');
});

test('CLI readiness uses only the non-executing preflight command and rejects false attachment claims', async () => {
  const { store, calls } = fixture(() => ({ cliType: 'claude', executableFound: true, executablePath: '/fixture/claude', attachedToHarness: false, requiredProtocol: 'stage0-review-cli-v1', message: 'No process was run' }));
  await store.getState().inspectCli('claude');
  assert.deepEqual(calls, [['inspect_harness_cli', { cliType: 'claude' }]]);
  assert.equal(store.getState().cli.attachedToHarness, false);
  const bad = fixture(() => report({ attachedToHarness: true }));
  await bad.store.getState().discover(connection(), true);
  assert.equal(bad.store.getState().mcp.external.status, 'failed');
  assert.equal(bad.store.getState().mcp.external.report, null);
});

test('browser-only sessions and network failures remain explicit errors without discovered/attached success', async () => {
  const browser = fixture(() => report(), false);
  await browser.store.getState().discover(connection(), true); await browser.store.getState().inspectCli('claude');
  assert.deepEqual(browser.calls, []); assert.match(browser.store.getState().cliError, /native desktop/);
  const failed = fixture(() => { throw new Error('Fixture timeout'); });
  await failed.store.getState().discover(connection(), true);
  assert.equal(failed.store.getState().mcp.external.status, 'failed'); assert.equal(failed.store.getState().mcp.external.report, null);
});

test('connector UI resets endpoint consent after edits, consumes it on discovery and does not auto-connect', async () => {
  const harness = componentHarness(); let discoveries = 0;
  const config = { mcpServers: [connection()] };
  const state = { mcp: {}, cli: null, cliError: null, isInspectingCli: false, discover: async () => { discoveries++; }, inspectCli: async () => {} };
  const { HarnessConnectionsPanel } = loadWithMocks(new URL('../frontend/features/review/components/HarnessConnectionsPanel.tsx', import.meta.url), {
    react: harness.react,
    '../../../common/components/CustomSelect': { CustomSelect: () => null },
    '../../ai/store/useAiMcpStore': { useAiMcpStore: (selector) => selector(config) },
    '../store/useHarnessConnectionStore': { useHarnessConnectionStore: () => state },
    '../utils/mcpConnectionKey': keys,
  });
  const nodes = async () => componentNodes(await harness.render(HarnessConnectionsPanel));
  const button = (items) => items.find((node) => node.type === 'button' && node.props.children.flat(Infinity).includes('Discover tools'));
  try {
    let items = await nodes(); assert.equal(discoveries, 0); assert.equal(button(items).props.disabled, true);
    items.find((node) => node.type === 'input').props.onChange({ target: { checked: true } });
    items = await nodes(); assert.equal(button(items).props.disabled, false);
    config.mcpServers = [connection({ url: 'http://localhost:9000/mcp' })];
    items = await nodes(); assert.equal(button(items).props.disabled, true);
    items.find((node) => node.type === 'input').props.onChange({ target: { checked: true } });
    items = await nodes(); button(items).props.onClick(); items = await nodes();
    assert.equal(discoveries, 1); assert.equal(button(items).props.disabled, true);
  } finally { harness.cleanup(); }
});
