import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { deviceAuthFixture, deviceStatus, deferred } from './helpers/deviceAuthHarness.mjs';

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

// Provider-store browser cards and native browser IPC were retired by ACP.
// Exercise retained store contracts with fixtures and guard the retired boundary;
// these fixtures do not claim the old commands are registered in the live app.
test('retained auth starts once through backend IPC without frontend URLs, credentials or model calls', async () => {
  const pending = deferred();
  const { store, calls } = deviceAuthFixture((name) =>
    name === 'chatgpt_device_auth_start' ? pending.promise : deviceStatus('cancelled'));
  const first = store.getState().start();
  await store.getState().start();
  assert.deepEqual(calls, [['chatgpt_device_auth_start']]);
  pending.resolve(deviceStatus('pending')); await first;
  assert.equal(store.getState().status.phase, 'pending');
  await store.getState().cancel();
  assert.deepEqual(calls[1], ['chatgpt_device_auth_cancel', { attemptId: 'attempt-a' }]);
  assert.doesNotMatch(JSON.stringify(calls), /open_external_url|auth_url|clientId|token|ai_chat_dispatch|fetch_ai_models/);
});

test('retired browser registration code keeps exact profile identity and is not exposed by the live app', async () => {
  assert.doesNotMatch(source('backend/src/features/ai/mod.rs'), /mod\s+(?:chatgpt_oauth|codex_auth)\b/);
  assert.doesNotMatch(source('backend/src/lib.rs'), /chatgpt_oauth_start|chatgpt_device_auth_start/);
  const native = source('backend/src/features/ai/chatgpt_oauth.rs');
  for (const [start, end] of [
    ['pub async fn start_chatgpt_oauth(', 'pub async fn check_chatgpt_auth_status('],
    ['pub async fn refresh_chatgpt_session(', 'pub async fn disconnect_chatgpt_subscription('],
    ['pub async fn disconnect_chatgpt_subscription(', 'pub async fn chat_chatgpt_subscription('],
  ]) {
    const action = native.slice(native.indexOf(start), native.indexOf(end));
    assert.match(action, /profile_id/);
    assert.match(action, /find\(\|p\| p\.id == (?:id|profile_id)\)/);
    assert.match(action, /Saved ChatGPT registration not found/);
    assert.doesNotMatch(action, /client_id:\s*(?:String|&str)/);
  }
  const { store, calls } = deviceAuthFixture(() => deviceStatus('signed_out'));
  store.setState({ status: deviceStatus('signed_in') });
  await store.getState().logout();
  assert.deepEqual(calls, [['chatgpt_device_auth_logout', { attemptId: 'attempt-a' }]]);
  assert.doesNotMatch(JSON.stringify(calls), /profileId|clientId/);
});

test('late metadata cannot restore cancelled auth and public projection drops tokens and private IDs', async () => {
  const pending = deferred();
  const { store } = deviceAuthFixture((name) =>
    name === 'chatgpt_device_auth_status' ? pending.promise : deviceStatus('cancelled'));
  store.setState({ status: deviceStatus('pending') });
  const polling = store.getState().refresh();
  await store.getState().cancel(); pending.resolve(deviceStatus('pending')); await polling;
  assert.equal(store.getState().status.phase, 'cancelled');
  const publicOnly = deviceAuthFixture(() => deviceStatus('signed_in', {
    access_token: 'private-access', refresh_token: 'private-refresh', client_id: 'private-client',
    id_token: 'private-id', plan_usage_enabled: true,
  }));
  await publicOnly.store.getState().refresh();
  assert.doesNotMatch(JSON.stringify(publicOnly.store.getState().status), /private-/);
  assert.equal('plan_usage_enabled' in publicOnly.store.getState().status, false);
});

test('concurrent starts deduplicate, native/browser errors remain failures and legacy state is rejected', async () => {
  const pending = deferred(), fixture = deviceAuthFixture(() => pending.promise);
  const first = fixture.store.getState().start(); await fixture.store.getState().start();
  assert.equal(fixture.calls.length, 1); pending.resolve(deviceStatus('pending')); await first;
  const web = deviceAuthFixture(() => assert.fail('IPC must not run in web-only mode'), false);
  await web.store.getState().start(); assert.match(web.store.getState().error, /native Stage0/);
  assert.deepEqual(web.calls, []);
  const native = deviceAuthFixture(() => { throw new Error('Native login failed'); });
  await native.store.getState().start();
  assert.equal(native.store.getState().status, null);
  assert.match(native.store.getState().error, /Native login failed/);
  const legacy = deviceAuthFixture(() => ({ connected: true })); await legacy.store.getState().start();
  assert.equal(legacy.store.getState().status, null);
  assert.match(legacy.store.getState().error, /Invalid/);
});

test('partial sign-out failure re-reads metadata and cannot resurrect stale connected status', async () => {
  for (const recoveryFails of [false, true]) {
    const { store, calls } = deviceAuthFixture((name) => {
      if (name === 'chatgpt_device_auth_logout') throw new Error('Local sign-out completed but cleanup was incomplete');
      assert.equal(name, 'chatgpt_device_auth_status');
      if (recoveryFails) throw new Error('Metadata unavailable');
      return deviceStatus('signed_out');
    });
    store.setState({ status: deviceStatus('signed_in', { accountEmail: 'account@example.test' }) });
    await store.getState().logout();
    assert.equal(store.getState().status?.phase ?? null, recoveryFails ? null : 'signed_out');
    assert.match(store.getState().error, /cleanup was incomplete/);
    assert.equal(store.getState().isActing, false);
    assert.deepEqual(calls.map(([name]) => name), ['chatgpt_device_auth_logout', 'chatgpt_device_auth_status']);
  }
});

test('active ACP account UI never starts login on render and exposes only the selected agent method', async () => {
  const harness = componentHarness(), calls = [];
  const { AcpAgentAccountSection } = loadWithMocks(
    new URL('../frontend/features/ai/components/external-agents/AcpAgentAccountSection.tsx', import.meta.url), {
      react: harness.react, '@tauri-apps/api/core': { isTauri: () => true },
      '../../../../common/components/CustomSelect': { CustomSelect: () => null },
    });
  const method = { id: 'agent-oauth', name: 'Agent sign-in', type: 'agent' };
  const account = { authStatus: null, lastSuccessfulSignIn: null, isCheckingAuth: false,
    supportsAuthStatus: false, authMethods: [method], selectedAuthMethod: method.id,
    setSelectedAuthMethod: (id) => { account.selectedAuthMethod = id; calls.push(['method', id]); },
    busyId: null, isProtocolAuthMethod: () => true, selectedAuthOption: method,
    signIn: async () => calls.push(['start', account.selectedAuthMethod]),
  };
  try {
    let items = componentNodes(await harness.render(AcpAgentAccountSection, { agentId: 'agent-a', account }));
    assert.deepEqual(calls, []);
    assert.match(JSON.stringify(items), /Stage0 never reads or stores its credentials/);
    assert.match(JSON.stringify(items), /Stage0 cannot determine whether it is signed in/);
    const select = items.find((node) => node.props?.['aria-label'] === 'ACP sign-in method');
    select.props.onChange('chosen-method');
    items = componentNodes(await harness.render(AcpAgentAccountSection, { agentId: 'agent-a', account }));
    const connect = items.find((node) => node.type === 'button');
    assert.equal(connect.props.disabled, false);
    await connect.props.onClick();
    assert.deepEqual(calls, [['method', 'chosen-method'], ['start', 'chosen-method']]);
    account.busyId = 'agent-a';
    items = componentNodes(await harness.render(AcpAgentAccountSection, { agentId: 'agent-a', account }));
    assert.equal(items.find((node) => node.type === 'button').props.disabled, true);
  } finally { harness.cleanup(); }
});

test('native provider UI keeps retired browser/device cards out and ACP owns external sign-in', () => {
  const tab = source('frontend/features/ai/components/AiMcpTab.tsx');
  assert.match(tab, /<AiMcpProviderDetailsModal/);
  assert.match(tab, /<ProviderSetupModal/);
  assert.doesNotMatch(tab, /ChatGptBrowserAuthCard|ChatGptDeviceCodeCard|startChatGptOAuth/);
  const external = source('frontend/features/ai/components/useAcpAgentAccount.ts');
  assert.match(external, /externalAgents\.acpAgentAuthenticate/);
  assert.match(source('frontend/features/ai/services/transport/createExternalAgentService.ts'), /acp_agent_authenticate/);
  assert.doesNotMatch(external, /chatgpt_oauth_start|store_ai_api_key|ai_chat_dispatch/);
  const backend = source('backend/src/features/ai/chatgpt_oauth.rs');
  assert.doesNotMatch(backend, /Command::|CODEX_HOME|openai_subscription|chat\/completions|PENDING_CHATGPT_VERIFIER/);
  assert.match(backend, /general AI chat adapter is not connected to Responses API yet/);
});
