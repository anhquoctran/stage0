import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const { create } = createRequire(import.meta.url)('zustand');
const url = (path) => new URL(`../frontend/features/ai/${path}`, import.meta.url);
const presets = loadWithMocks(url('constants/aiPresets.ts'), {});
const guards = loadWithMocks(url('types/guardrails.ts'), {});
const availability = loadWithMocks(url('constants/runtimeAvailability.ts'), {});
const verification = loadWithMocks(url('utils/resetMcpVerification.ts'), {});
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

async function fixture(run, handler = async () => undefined) {
  const oldWindow = globalThis.window; const oldStorage = globalThis.localStorage;
  let startup; const calls = [];
  globalThis.window = { setTimeout: (fn) => { startup = fn; } };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  try {
    const { useAiMcpStore: store } = loadWithMocks(url('store/useAiMcpStore.ts'), {
      zustand: { create }, '../constants/aiPresets': presets, '../types/guardrails': guards,
      '../constants/runtimeAvailability': availability, '../utils/resetMcpVerification': verification,
      '@tauri-apps/api/core': { isTauri: () => true, invoke: async (...args) => { calls.push(args); return handler(...args); } },
    });
    await run(store, calls, () => startup());
  } finally { globalThis.window = oldWindow; globalThis.localStorage = oldStorage; }
}

test('startup, provider selection and API key save cannot automatically read secrets or fetch models', async () => {
  await fixture(async (store, calls, startup) => {
    startup(); await new Promise((resolve) => setImmediate(resolve));
    const allowed = new Set(['commit_ai_preferences', 'get_guardrail_policy', 'get_guardrail_audit_log', 'ai_detect_cli']);
    assert.ok(calls.length > 0 && calls.every(([command]) => allowed.has(command)));
    calls.length = 0;
    store.getState().setProvider('anthropic');
    assert.deepEqual(calls, []);
    store.getState().updateAiConfig({ apiKey: 'fixture-new-secret' });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls.map(([command]) => command), ['store_ai_api_key']);
  }, async (command) => command === 'get_guardrail_policy' ? guards.DEFAULT_GUARDRAIL_POLICY : command === 'get_guardrail_audit_log' ? [] : {});
});

test('explicit key check is single-flight, does not chain a model request and denial never retries itself', async () => {
  const pending = deferred();
  await fixture(async (store, calls) => {
    const first = store.getState().loadApiKeyForProvider('openai');
    await store.getState().loadApiKeyForProvider('openai');
    assert.equal(calls.length, 1); assert.equal(store.getState().isCheckingApiKey, true);
    pending.resolve(true); await first;
    assert.equal(store.getState().apiKeysConfigured.openai, true);
    assert.equal(store.getState().isCheckingApiKey, false); assert.equal(calls.length, 1);
  }, () => pending.promise);
  await fixture(async (store, calls) => {
    await store.getState().loadApiKeyForProvider('openai');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.length, 1); assert.equal(store.getState().apiKeysConfigured.openai, undefined);
    assert.match(store.getState().apiKeyCheckError, /denied or unavailable/);
    assert.equal(store.getState().isCheckingApiKey, false);
  }, async () => { throw new Error('fixture access denied'); });
});

test('explicit model refresh uses the selected endpoint, coalesces repeated clicks and refuses pending secrets', async () => {
  const pending = deferred();
  await fixture(async (store, calls) => {
    const selected = { ...presets.DEFAULT_AI_CONFIG, provider: 'custom', baseUrl: 'https://fixture.test/v1' };
    const rejected = await store.getState().fetchDynamicModels({ ...selected, apiKey: 'fixture-unsaved-secret' });
    assert.equal(rejected.success, false); assert.deepEqual(calls, []);
    const first = store.getState().fetchDynamicModels(selected);
    await store.getState().fetchDynamicModels(selected);
    assert.deepEqual(calls, [['fetch_ai_models', { provider: 'custom', apiKey: null, baseUrl: selected.baseUrl }]]);
    pending.resolve([{ id: 'fixture-model', name: 'Fixture' }]);
    assert.equal((await first).success, true); assert.equal(store.getState().isFetchingDynamicModels, false);
  }, () => pending.promise);
});

test('explicit subscription checks are single-flight and Google sign-in never starts keyring polling', async () => {
  const pending = deferred();
  await fixture(async (store, calls) => {
    const first = store.getState().checkCopilotStatus();
    await store.getState().checkCopilotStatus(); await store.getState().checkGoogleAuthStatus();
    assert.equal(calls.length, 1);
    pending.resolve({ connected: true, has_subscription: true }); await first;
    assert.equal(store.getState().isCheckingSubscription, false);
  }, () => pending.promise);
  await fixture(async (store, calls) => {
    await store.getState().startGoogleOAuth();
    assert.deepEqual(calls.map(([command]) => command), ['google_oauth_start', 'open_external_url']);
  }, async () => ({ auth_url: 'https://fixture.test/authorize' }));
});

test('ChatGPT saved credentials require an explicit load; failure recovery and polling use metadata only', async () => {
  const pending = deferred();
  const status = { connected: false, phase: 'signed_out', profiles: [], credentials_loaded: true };
  await fixture(async (store, calls) => {
    const first = store.getState().loadSavedChatGptAuth();
    await store.getState().loadSavedChatGptAuth();
    assert.deepEqual(calls.map(([command]) => command), ['chatgpt_oauth_load_saved']);
    pending.reject(new Error('fixture keyring denied')); await first;
    assert.deepEqual(calls.map(([command]) => command), ['chatgpt_oauth_load_saved', 'chatgpt_oauth_check_status']);
    assert.match(store.getState().chatgptAuthStatus.error, /denied/);
    await store.getState().checkChatGptAuthStatus();
    assert.equal(calls.at(-1)[0], 'chatgpt_oauth_check_status');
  }, (command) => command === 'chatgpt_oauth_load_saved' ? pending.promise : status);
  const native = readFileSync(new URL('../backend/src/features/ai/chatgpt_oauth.rs', import.meta.url), 'utf8');
  const passive = native.split('pub async fn check_chatgpt_auth_status()')[1].split('pub async fn load_saved_chatgpt_auth()')[0];
  assert.match(passive, /\.status\(\)/); assert.doesNotMatch(passive, /AuthCatalog::load|snapshot|keyring/);
});

test('macOS legacy migration uses exact item queries with no authentication UI or global access-control changes', () => {
  const native = readFileSync(new URL('../backend/src/features/ai/chatgpt_oauth/macos_legacy_keyring.rs', import.meta.url), 'utf8');
  assert.match(native, /kSecUseAuthenticationUIFail/);
  assert.match(native, /kSecAttrService/); assert.match(native, /kSecAttrAccount/);
  assert.match(native, /SecItemCopyMatching/);
  assert.doesNotMatch(native, /SecKeychainSetUserInteractionAllowed|SecKeychainItemSetAccess|kSecUseAuthenticationUIAllow/);
  const card = readFileSync(url('components/ChatGptBrowserAuthCard.tsx'), 'utf8');
  assert.match(card, /Older keyring items are retained/);
});
