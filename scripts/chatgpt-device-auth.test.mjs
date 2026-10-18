import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { loadWithMocks, componentHarness, componentNodes } from './helpers/componentHarness.mjs';

const { create } = createRequire(import.meta.url)('zustand');
const status = (phase = 'pending', overrides = {}) => ({ attemptId: 'attempt', phase, userCode: phase === 'pending' ? 'ABCD-1234' : null, verificationUrl: phase === 'pending' ? 'https://auth.openai.com/codex/device' : null, accountEmail: null, planType: null, deadlineAt: null, error: null, ...overrides });
function deferred() { let resolve; const promise = new Promise((ok) => { resolve = ok; }); return { promise, resolve }; }
function fixture(handler = () => status(), native = true) {
  const calls = [];
  const { useChatGptDeviceAuthStore: store } = loadWithMocks(new URL('../frontend/features/ai/store/useChatGptDeviceAuthStore.ts', import.meta.url), {
    zustand: { create }, '@tauri-apps/api/core': { isTauri: () => native, invoke: async (...args) => { calls.push(args); return handler(...args); } },
  });
  return { store, calls };
}

test('opening or polling auth metadata never starts a login process', async () => {
  const { store, calls } = fixture(() => status('idle'));
  assert.deepEqual(calls, []); await store.getState().refresh();
  assert.deepEqual(calls, [['chatgpt_device_auth_status']]);
});

test('device login/check/cancel/logout use auth-only IPC with attempt-bound control, not credentials or arbitrary client IDs', async () => {
  const { store, calls } = fixture((name) => name.endsWith('cancel') ? status('cancelling') : status());
  await store.getState().start(); await store.getState().cancel(); await store.getState().checkSaved(); await store.getState().logout();
  assert.deepEqual(calls.map((call) => call[0]), ['chatgpt_device_auth_start', 'chatgpt_device_auth_cancel', 'chatgpt_device_auth_check', 'chatgpt_device_auth_logout']);
  assert.deepEqual(calls[1][1], { attemptId: 'attempt' }); assert.deepEqual(calls[3][1], { attemptId: 'attempt' });
  assert.doesNotMatch(JSON.stringify(calls), /accessToken|refreshToken|apiKey|clientId|prompt|repoPath/);
});

test('stale polling cannot resurrect a device code after cancellation or a newer completed status', async () => {
  const first = deferred(); const second = deferred(); let polls = 0;
  const { store } = fixture((name) => name === 'chatgpt_device_auth_status' ? ++polls === 1 ? first.promise : second.promise : status('cancelled'));
  store.setState({ status: status() });
  const old = store.getState().refresh(); await store.getState().cancel(); first.resolve(status()); await old;
  assert.equal(store.getState().status.phase, 'cancelled'); assert.equal(store.getState().status.userCode, null);
  const pending = store.getState().refresh(); second.resolve(status('signed_in')); await pending;
  assert.equal(store.getState().status.phase, 'signed_in');
});

test('frontend keeps only public metadata and clears pending codes on terminal states', async () => {
  const { store } = fixture(() => status('signed_in', { userCode: 'ABCD-1234', accessToken: 'fixture-secret', refreshToken: 'fixture-secret', loginId: 'backend-only' }));
  await store.getState().start();
  assert.equal(store.getState().status.userCode, null);
  assert.doesNotMatch(JSON.stringify(store.getState().status), /fixture-secret|backend-only|ABCD-1234/);
  const spoofed = fixture(() => status('pending', { verificationUrl: 'https://evil.example/device' }));
  await spoofed.store.getState().start(); assert.equal(spoofed.store.getState().status, null); assert.match(spoofed.store.getState().error, /Refusing/);
});

test('unsupported/browser-only sign-in is an explicit failure, never a simulated connection', async () => {
  const browser = fixture(() => status('signed_in'), false); await browser.store.getState().start();
  assert.deepEqual(browser.calls, []); assert.match(browser.store.getState().error, /native Stage0/);
  const failed = fixture(() => { throw new Error('Codex CLI unavailable'); }); await failed.store.getState().start();
  assert.equal(failed.store.getState().status, null); assert.equal(failed.store.getState().isActing, false);
});

test('device-code UI consumes explicit launch consent, opens only the pinned official URL and never starts on render', async () => {
  const harness = componentHarness(); let starts = 0; let refreshes = 0; const calls = [];
  const state = { status: status('idle'), isActing: false, error: null, refresh: async () => { refreshes++; }, start: async () => { starts++; }, checkSaved: async () => {}, cancel: async () => {}, logout: async () => {} };
  const { ChatGptDeviceCodeCard } = loadWithMocks(new URL('../frontend/features/ai/components/ChatGptDeviceCodeCard.tsx', import.meta.url), {
    react: harness.react, '@tauri-apps/api/core': { invoke: async (...args) => { calls.push(args); } },
    '../store/useChatGptDeviceAuthStore': { useChatGptDeviceAuthStore: () => state }, '../../../common/utils/dateTime': { formatDateTime: (s) => s },
  });
  const nodes = async () => componentNodes(await harness.render(ChatGptDeviceCodeCard));
  const button = (items, label) => items.find((item) => item.type === 'button' && item.props.children.flat(Infinity).includes(label));
  try {
    let items = await nodes(); assert.equal(starts, 0); assert.equal(refreshes, 1); assert.equal(button(items, 'Continue with ChatGPT').props.disabled, true);
    items.find((item) => item.type === 'input').props.onChange({ target: { checked: true } }); items = await nodes();
    button(items, 'Continue with ChatGPT').props.onClick(); items = await nodes(); assert.equal(starts, 1); assert.equal(button(items, 'Continue with ChatGPT').props.disabled, true);
    state.status = status(); items = await nodes(); await button(items, 'Open sign-in page').props.onClick();
    assert.deepEqual(calls, [['open_external_url', { url: 'https://auth.openai.com/codex/device' }]]);
    state.status = status('pending', { verificationUrl: 'https://evil.example/device' }); items = await nodes();
    assert.equal(button(items, 'Open sign-in page').props.disabled, true); await button(items, 'Open sign-in page').props.onClick(); assert.equal(calls.length, 1);
    state.status = status('signed_in'); items = await nodes(); assert.equal(button(items, 'Copy code'), undefined);
  } finally { harness.cleanup(); }
});

test('device auth does not reuse private OAuth clients, browser cookies or the legacy subscription inference path', () => {
  const source = readFileSync(new URL('../backend/src/features/ai/codex_auth/protocol.rs', import.meta.url), 'utf8');
  assert.match(source, /chatgptDeviceCode/); assert.doesNotMatch(source, /auth\.openai\.com\/api|dynamic_agent_client|app_EMo/);
  const store = readFileSync(new URL('../frontend/features/ai/store/useChatGptDeviceAuthStore.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(store, /localStorage|ai_chat_dispatch|start_ai_review/);
});
