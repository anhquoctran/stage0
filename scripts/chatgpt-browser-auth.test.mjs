import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const { create } = require('zustand');
const load = (path) => loadWithMocks(new URL(`../frontend/features/ai/${path}`, import.meta.url), {});
const presets = load('constants/aiPresets.ts');
const guardrails = load('types/guardrails.ts');
const availability = load('constants/runtimeAvailability.ts');
const normalization = load('utils/resetMcpVerification.ts');
const profile = { id: 'profile-a', label: 'Connection A', email: 'fixture@example.test', signed_in: true };
const status = (phase = 'signed_out', extra = {}) => ({ connected: phase === 'signed_in', phase, attempt_id: phase === 'pending' ? 'attempt-a' : null, active_profile_id: phase === 'signed_in' ? profile.id : null, plan_usage_enabled: false, profiles: [profile], ...extra });
function deferred() { let resolve; const promise = new Promise((ok) => { resolve = ok; }); return { promise, resolve }; }
function fixture(handler, native = true) {
  const calls = [];
  const { useAiMcpStore: store } = loadWithMocks(new URL('../frontend/features/ai/store/useAiMcpStore.ts', import.meta.url), {
    zustand: { create }, '@tauri-apps/api/core': { isTauri: () => native, invoke: async (...args) => { calls.push(args); return handler(...args); } },
    '../constants/aiPresets': presets, '../types/guardrails': guardrails,
    '../constants/runtimeAvailability': availability, '../utils/resetMcpVerification': normalization,
  });
  return { store, calls };
}
test('browser auth starts once through backend IPC without CLI, browser URL, keys or model calls from FE', async () => {
  const { store, calls } = fixture(() => status('pending'));
  await store.getState().startChatGptOAuth();
  assert.deepEqual(calls, [['chatgpt_oauth_start', { profileId: null }]]);
  assert.equal(store.getState().chatgptAuthStatus.phase, 'pending');
  await store.getState().cancelChatGptOAuth();
  assert.deepEqual(calls[1], ['chatgpt_oauth_cancel', { attemptId: 'attempt-a' }]);
  assert.doesNotMatch(JSON.stringify(calls), /open_external_url|device_auth|auth_url|clientId|token|ai_chat_dispatch|fetch_ai_models/);
});
test('saved registration controls address the chosen profile, not another connection or a supplied client ID', async () => {
  const { store, calls } = fixture(() => status('signed_in'));
  await store.getState().startChatGptOAuth('profile-b');
  await store.getState().refreshChatGptSession('profile-c');
  await store.getState().disconnectChatGptOAuth('profile-d');
  assert.deepEqual(calls, [
    ['chatgpt_oauth_start', { profileId: 'profile-b' }], ['chatgpt_oauth_refresh', { profileId: 'profile-c' }], ['chatgpt_oauth_disconnect', { profileId: 'profile-d' }],
  ]);
});
test('late metadata cannot restore a cancelled attempt; public projection drops tokens and private IDs', async () => {
  const pending = deferred();
  const { store } = fixture((name) => name === 'chatgpt_oauth_check_status' ? pending.promise : status('cancelled'));
  store.setState({ chatgptAuthStatus: status('pending') });
  const polling = store.getState().checkChatGptAuthStatus();
  await store.getState().cancelChatGptOAuth(); pending.resolve(status('pending')); await polling;
  assert.equal(store.getState().chatgptAuthStatus.phase, 'cancelled');
  const publicOnly = fixture(() => status('signed_in', { access_token: 'private-access', refresh_token: 'private-refresh', client_id: 'private-client', profiles: [{ ...profile, id_token: 'private-id' }] }));
  await publicOnly.store.getState().checkChatGptAuthStatus();
  assert.doesNotMatch(JSON.stringify(publicOnly.store.getState().chatgptAuthStatus), /private-/);
  assert.equal(publicOnly.store.getState().chatgptAuthStatus.plan_usage_enabled, false);
});
test('concurrent starts deduplicate, native/browser errors remain failures and no legacy status is accepted', async () => {
  const pending = deferred(); const { store, calls } = fixture(() => pending.promise);
  const first = store.getState().startChatGptOAuth(); await store.getState().startChatGptOAuth();
  assert.equal(calls.length, 1); pending.resolve(status('pending')); await first;
  const web = fixture(() => assert.fail('IPC must not run in web-only mode'), false);
  await web.store.getState().startChatGptOAuth(); assert.match(web.store.getState().chatgptAuthStatus.error, /native Stage0/);
  const legacy = fixture(() => ({ connected: true })); await legacy.store.getState().startChatGptOAuth();
  assert.equal(legacy.store.getState().chatgptAuthStatus.connected, false);
  assert.match(legacy.store.getState().chatgptAuthStatus.error, /Invalid/);
});
test('partial sign-out failure re-reads metadata instead of resurrecting the previous connected flag', async () => {
  const { store, calls } = fixture((name) => {
    if (name === 'chatgpt_oauth_disconnect') throw new Error('Local sign-out completed but keyring cleanup was incomplete');
    assert.equal(name, 'chatgpt_oauth_check_status'); return status('signed_out');
  });
  store.setState({ chatgptAuthStatus: status('signed_in', { plan_usage_enabled: true }) });
  await store.getState().disconnectChatGptOAuth(profile.id);
  assert.equal(store.getState().chatgptAuthStatus.connected, false);
  assert.equal(store.getState().chatgptAuthStatus.plan_usage_enabled, false);
  assert.match(store.getState().chatgptAuthStatus.error, /cleanup was incomplete/);
  assert.deepEqual(calls.map(([name]) => name), ['chatgpt_oauth_disconnect', 'chatgpt_oauth_check_status']);
});
test('browser card never starts login on render, exposes saved profiles and keeps inference limitations explicit', async () => {
  const harness = componentHarness(); const calls = [];
  const state = { chatgptAuthStatus: status(), isConnectingSubscription: false,
    startChatGptOAuth: async (id) => calls.push(['start', id]), checkChatGptAuthStatus: async () => calls.push(['metadata']),
    loadSavedChatGptAuth: async () => calls.push(['unlock']),
    cancelChatGptOAuth: async () => calls.push(['cancel']), disconnectChatGptOAuth: async (id) => calls.push(['logout', id]), refreshChatGptSession: async (id) => calls.push(['refresh', id]),
  };
  const select = () => null;
  const { ChatGptBrowserAuthCard: Card } = loadWithMocks(new URL('../frontend/features/ai/components/ChatGptBrowserAuthCard.tsx', import.meta.url), {
    react: harness.react, '../store/useAiMcpStore': { useAiMcpStore: () => state }, '../../../common/components/CustomSelect': { CustomSelect: select },
  });
  const nodes = async () => componentNodes(await harness.render(Card));
  const button = (items, label) => items.find((node) => node.type === 'button' && node.props.children.flat(Infinity).includes(label));
  try {
    let items = await nodes(); assert.deepEqual(calls, [['metadata']]);
    assert.match(JSON.stringify(items), /No Codex CLI/); assert.match(JSON.stringify(items), /not yet connected/);
    await button(items, 'Check saved sign-in').props.onClick(); assert.deepEqual(calls.at(-1), ['unlock']);
    items.find((node) => node.type === select).props.onChange(profile.id); items = await nodes();
    await button(items, 'Continue with ChatGPT').props.onClick(); assert.deepEqual(calls.at(-1), ['start', profile.id]);
    await button(items, 'Sign out selected connection').props.onClick(); assert.deepEqual(calls.at(-1), ['logout', profile.id]);
    state.chatgptAuthStatus = status('pending'); items = await nodes();
    assert.equal(button(items, 'Continue with ChatGPT'), undefined);
    await button(items, 'Cancel sign-in').props.onClick(); assert.deepEqual(calls.at(-1), ['cancel']);
  } finally { harness.cleanup(); }
});
test('default subscription UI uses direct browser auth and preserves Codex only as an advanced separate option', () => {
  const source = readFileSync(new URL('../frontend/features/ai/components/AiMcpTab.tsx', import.meta.url), 'utf8');
  assert.match(source, /<ChatGptBrowserAuthCard\s*\/>/);
  assert.match(source, /<details[\s\S]*?Advanced: Codex-managed device code[\s\S]*?<ChatGptDeviceCodeCard/);
  const backend = readFileSync(new URL('../backend/src/features/ai/chatgpt_oauth.rs', import.meta.url), 'utf8');
  assert.doesNotMatch(backend, /Command::|CODEX_HOME|openai_subscription|chat\/completions|PENDING_CHATGPT_VERIFIER/);
  assert.match(backend, /No inference request was sent/);
});
