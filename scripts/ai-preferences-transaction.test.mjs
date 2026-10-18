import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const { create } = require('zustand');
const url = (path) => new URL(`../frontend/${path}`, import.meta.url);
const presets = loadWithMocks(url('features/ai/constants/aiPresets.ts'), {});
const guards = loadWithMocks(url('features/ai/types/guardrails.ts'), {});
const bots = loadWithMocks(url('features/ai/constants/botPresets.ts'), {});
const verification = loadWithMocks(url('features/ai/utils/resetMcpVerification.ts'), {});
const availability = loadWithMocks(url('features/ai/constants/runtimeAvailability.ts'), {});
const guardrailPresets = loadWithMocks(url('features/ai/utils/guardrailPreset.ts'), { '../types/guardrails': guards });
const snapshots = loadWithMocks(url('features/ai/utils/aiPreferencesSnapshot.ts'), { './resetMcpVerification': verification });
const { createAiPreferencesDraft } = loadWithMocks(url('features/ai/store/createAiPreferencesDraft.ts'), {
  zustand: { create }, '../constants/botPresets': bots, '../constants/runtimeAvailability': availability,
  '../utils/resetMcpVerification': verification, '../utils/guardrailPreset': guardrailPresets,
});
const baseline = () => ({ aiConfig: structuredClone(presets.DEFAULT_AI_CONFIG), mcpServers: [], guardrailPolicy: structuredClone(guards.DEFAULT_GUARDRAIL_POLICY), globalReviewers: [] });
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('every AI config field participates in dirty detection, including provider/model/auth mode/key drafts', () => {
  for (const [key, value] of Object.entries({ provider: 'anthropic', model: 'fixture', authMode: 'subscription_oauth', cliType: 'grok', baseUrl: 'https://fixture.test/v1', temperature: 0.7, maxTokens: 2048, systemPrompt: 'Fixture prompt', streamResponse: false, enableCodeReviewAssist: false, apiKey: 'fixture-secret' })) {
    const initial = baseline(); const store = createAiPreferencesDraft(initial);
    store.getState().updateAiConfig({ [key]: value });
    assert.equal(snapshots.aiPreferencesChangeCount(store.getState(), initial), 1, key);
    assert.deepEqual(initial, baseline());
  }
});

test('MCP CRUD/import, reviewers and guardrail presets change only the isolated draft; replace discards everything', async () => {
  const initial = baseline(); const store = createAiPreferencesDraft(initial);
  store.getState().addMcpServer({ name: 'Fixture', type: 'http', command: '', args: [], env: {}, url: 'https://fixture.test/mcp', enabled: true });
  const id = store.getState().mcpServers[0].id;
  store.getState().updateMcpServer(id, { name: 'Edited' }); store.getState().toggleMcpServer(id);
  assert.equal(store.getState().mcpServers[0].enabled, false);
  const before = snapshots.aiPreferencesChangeCount(store.getState(), initial);
  await store.getState().testMcpServer(id); assert.equal(snapshots.aiPreferencesChangeCount(store.getState(), initial), before);
  assert.equal(store.getState().mcpServers[0].testStatus, 'unavailable');
  assert.equal(store.getState().importMcpConfigFile('{"mcpServers":{"Imported":{"type":"sse","url":"https://fixture.test/sse"}}}').success, true);
  assert.match(store.getState().exportMcpConfigFile(), /Imported/);
  store.getState().addGlobalReviewer({ name: 'Agent', systemPrompt: 'Review', enabled: true });
  await store.getState().resetGuardrailPolicy('strict');
  assert.equal(store.getState().guardrailPolicy.max_execution_timeout_secs, 15);
  assert.equal(snapshots.aiPreferencesChangeCount(store.getState(), initial), 3);
  assert.deepEqual(initial, baseline()); store.getState().replace(initial);
  assert.equal(snapshots.aiPreferencesChangeCount(store.getState(), initial), 0);
  assert.deepEqual(store.getState().mcpServers, []);
});

test('provider switching retains separate pending keys without exporting or persisting them', () => {
  const initial = baseline(); const store = createAiPreferencesDraft(initial);
  store.getState().updateAiConfig({ provider: 'anthropic', apiKey: '' });
  store.getState().updateAiConfig({ apiKey: 'anthropic-secret' });
  store.getState().updateAiConfig({ provider: 'openai', apiKey: '' });
  store.getState().updateAiConfig({ apiKey: 'openai-secret' });
  store.getState().updateAiConfig({ provider: 'anthropic', apiKey: '' });
  assert.equal(store.getState().aiConfig.apiKey, 'anthropic-secret');
  assert.deepEqual(store.getState().apiKeyDrafts, { anthropic: 'anthropic-secret', openai: 'openai-secret' });
  assert.doesNotMatch(JSON.stringify(snapshots.cleanAiSnapshot(store.getState())), /-secret/);
  assert.doesNotMatch(store.getState().exportMcpConfigFile(), /-secret/);
  store.getState().replace(initial); assert.deepEqual(store.getState().apiKeyDrafts, {});
});

test('unchanged groups retain asynchronously loaded committed settings and conflicting edits fail explicitly', () => {
  const initial = baseline(); const draft = createAiPreferencesDraft(initial);
  draft.getState().updateAiConfig({ model: 'chosen-model' });
  const latest = baseline(); latest.guardrailPolicy = guardrailPresets.guardrailPreset('strict'); latest.aiConfig.maxTokens = 8192;
  const merged = snapshots.mergeAiPreferences(draft.getState(), initial, latest);
  assert.equal(merged.aiConfig.model, 'chosen-model'); assert.equal(merged.aiConfig.maxTokens, 8192); assert.equal(merged.guardrailPolicy.mode, 'strict');
  latest.aiConfig.model = 'external-change';
  assert.throws(() => snapshots.mergeAiPreferences(draft.getState(), initial, latest), /outside this dialog/);
});

function serviceFixture(handler = async () => ({})) {
  const initial = baseline(); const ai = create(() => ({ ...initial, apiKeysConfigured: {} })); const reviewers = create(() => ({ globalReviewers: [] }));
  const calls = []; const storage = new Map([['stage0_ai_mcp_config', JSON.stringify(initial)], ['stage0_global_bot_reviewers', '[]']]);
  const api = loadWithMocks(url('features/ai/services/commitAiPreferences.ts'), {
    '@tauri-apps/api/core': { isTauri: () => true, invoke: async (...args) => { calls.push(args); return handler(...args); } },
    '../store/useAiMcpStore': { useAiMcpStore: ai }, '../store/useBotReviewersStore': { useBotReviewersStore: reviewers },
    '../utils/aiPreferencesSnapshot': snapshots,
  });
  const local = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  return { initial, ai, reviewers, calls, storage, local, ...api };
}

test('Apply awaits one native key/policy batch, publishes all AI sections together and persists no API secrets', async () => {
  const native = deferred(); const fixture = serviceFixture(() => native.promise); const old = globalThis.localStorage; globalThis.localStorage = fixture.local;
  try {
    const draft = createAiPreferencesDraft(fixture.initial);
    draft.getState().updateAiConfig({ apiKey: 'fixture-private-key', maxTokens: 2048 });
    await draft.getState().resetGuardrailPolicy('strict'); draft.getState().addGlobalReviewer({ name: 'Agent', enabled: true });
    const save = fixture.commitAiPreferences(draft.getState(), fixture.initial);
    assert.equal(fixture.ai.getState().aiConfig.maxTokens, 4096); assert.equal(fixture.reviewers.getState().globalReviewers.length, 0);
    assert.equal(fixture.calls.length, 1); assert.equal(fixture.calls[0][0], 'commit_ai_preferences');
    assert.deepEqual(fixture.calls[0][1].apiKeys, { openai: 'fixture-private-key' });
    assert.doesNotMatch([...fixture.storage.values()].join(''), /fixture-private-key|apiKeyDrafts/);
    await assert.rejects(fixture.commitAiPreferences(draft.getState(), fixture.initial), /already in progress/);
    native.resolve({ openai: true }); const saved = await save;
    assert.equal(fixture.ai.getState().aiConfig.maxTokens, 2048); assert.equal(fixture.ai.getState().guardrailPolicy.mode, 'strict');
    assert.equal(fixture.reviewers.getState().globalReviewers.length, 1); assert.equal(fixture.ai.getState().apiKeysConfigured.openai, true);
    assert.equal(saved.aiConfig.apiKey, ''); assert.doesNotMatch(JSON.stringify(fixture.ai.getState()), /fixture-private-key/);
  } finally { globalThis.localStorage = old; }
});

test('keyring and storage failures preserve committed settings and keep pending secrets available for retry', async () => {
  for (const storageFailure of [false, true]) {
    const fixture = serviceFixture(async () => { throw new Error('OS keyring unavailable'); });
    const old = globalThis.localStorage; const previous = [...fixture.storage];
    let writes = 0;
    globalThis.localStorage = { ...fixture.local, setItem: (key, value) => { if (storageFailure && writes++ === 1) throw new Error('Storage full'); fixture.local.setItem(key, value); } };
    try {
      const draft = createAiPreferencesDraft(fixture.initial); draft.getState().updateAiConfig({ apiKey: 'retry-secret', maxTokens: 2048 });
      await assert.rejects(fixture.commitAiPreferences(draft.getState(), fixture.initial), /keyring unavailable|Storage full/);
      assert.deepEqual([...fixture.storage], previous); assert.equal(fixture.ai.getState().aiConfig.maxTokens, 4096);
      assert.equal(draft.getState().apiKeyDrafts.openai, 'retry-secret');
      assert.equal(fixture.calls.length, storageFailure ? 0 : 1);
    } finally { globalThis.localStorage = old; }
  }
});

function dialogFixture(commitHandler) {
  const harness = componentHarness(); let committed = baseline(); const preferences = {
    isPreferencesOpen: true, initialPreferencesTab: 'ai-providers', fontFamily: 'Fira Code', fontSize: 13,
    isBold: false, isItalic: false, isUnderline: false, lineSpacing: 1.5, enableLigatures: true, showInlineBlame: true,
    setIsPreferencesOpen: (value) => { preferences.isPreferencesOpen = value; },
    setInitialPreferencesTab: (value) => { preferences.initialPreferencesTab = value; },
    updateViewerFontSettings() {}, setShowInlineBlame() {},
  };
  let draftStore; let saves = 0; const child = () => null;
  const dependencies = {
    react: harness.react,
    '../store/usePreferencesStore': { usePreferencesStore: () => preferences, checkFontLigaturesSupport: () => true, applyViewerFontToDocument() {}, DEFAULT_VIEWER_FONT_SETTINGS: preferences },
    '../../../core/store/useThemeStore': { useThemeStore: () => ({ themeMode: 'system', setThemeMode() {} }), resolveTheme: () => 'dark', applyThemeToDocument() {} },
    '../constants/fonts': { SUPPORTED_FONTS: [{ fontFamilyName: 'Fira Code' }] },
    '../../../common/utils/shortcuts': { formatShortcutText: (s) => s },
    '../../git/store/useGitStore': { useGitStore: () => ({ activeSandboxType: 'in_memory', setActiveSandbox: async () => {}, showToast() {} }) },
    '../../git/store/useGitBinaryStore': { useGitBinaryStore: () => ({ activeBinaryId: 'system', activeBinaryPath: 'git', setActiveBinary: async () => {}, fetchActiveBinary: async () => ({ id: 'system', path: 'git' }) }) },
    '../../ai/store/createAiPreferencesDraft': { createAiPreferencesDraft: (snapshot) => { draftStore = createAiPreferencesDraft(snapshot); return Object.assign(() => draftStore.getState(), draftStore); } },
    '../../ai/services/commitAiPreferences': { captureAiPreferences: () => structuredClone(committed), commitAiPreferences: async (draft, base) => {
      saves++; if (commitHandler) await commitHandler(); committed = snapshots.mergeAiPreferences(draft, base, committed); return committed;
    } },
    '../../ai/utils/aiPreferencesSnapshot': snapshots, '../../ai/constants/aiPresets': presets, '../../ai/types/guardrails': guards, '../../ai/constants/botPresets': bots,
    '../../ai/components/AiMcpTab': { AiMcpTab: child },
    '../../ai/components/GuardrailsTab': { GuardrailsTab: child }, '../../ai/components/BotReviewersTab': { BotReviewersTab: child }, '../../ai/components/SandboxTab': { SandboxTab: child },
    '../../credentials/components/GitCredentialsTab': { GitCredentialsTab: child }, '../../git/components/GitBinaryTab': { GitBinaryTab: child }, '../../notifications/components/NotificationsTab': { NotificationsTab: child },
    './SettingRow': { SettingRow: child }, './ZedSwitch': { ZedSwitch: child },
  };
  for (const name of ['X', 'RotateCcw', 'Check', 'ChevronDown', 'ChevronRight', 'ChevronLeft', 'Search', 'Monitor', 'Moon', 'Sun', 'AlertCircle', 'AlertTriangle', 'Bold', 'Italic', 'Underline', 'Code']) dependencies[`../../../common/components/icons/${name}`] = { [name]: child };
  const { PreferencesModal } = loadWithMocks(url('features/preferences/components/PreferencesModal.tsx'), dependencies);
  return { harness, preferences, render: async () => componentNodes(await harness.render(PreferencesModal)), draft: () => draftStore.getState(), saved: () => committed, saves: () => saves };
}
const text = (node) => componentNodes(node).flatMap((item) => [item.props?.children].flat(Infinity)).filter((value) => typeof value === 'string').join(' ');
const button = (nodes, label) => nodes.find((node) => node.type === 'button' && text(node).trim() === label);

test('Preferences Apply saves AI-only edits, stays open and Cancel after Apply discards only later drafts', async () => {
  const original = globalThis.window; globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const fixture = dialogFixture();
  try {
    // Begin with an explicitly saved non-default provider, not the new first-launch default.
    fixture.saved().aiConfig.provider = 'anthropic';
    let nodes = await fixture.render(); assert.equal(button(nodes, 'Apply').props.disabled, true); assert.equal(button(nodes, 'OK').props.disabled, false);
    fixture.draft().updateAiConfig({ provider: 'openai', authMode: 'subscription_oauth', model: 'chosen-model' }); nodes = await fixture.render();
    assert.equal(button(nodes, 'Apply').props.disabled, false);
    await button(nodes, 'Apply').props.onClick(); nodes = await fixture.render();
    assert.equal(fixture.saves(), 1); assert.equal(fixture.saved().aiConfig.provider, 'openai'); assert.equal(fixture.preferences.isPreferencesOpen, true);
    fixture.draft().updateAiConfig({ maxTokens: 2048 }); fixture.draft().addGlobalReviewer({ name: 'Unsaved' });
    nodes = await fixture.render(); button(nodes, 'Cancel').props.onClick(); await fixture.render();
    assert.equal(fixture.saved().aiConfig.model, 'chosen-model'); assert.equal(fixture.saved().aiConfig.maxTokens, 4096);
    assert.equal(fixture.saved().globalReviewers.length, 0); assert.equal(fixture.preferences.isPreferencesOpen, false);
  } finally { fixture.harness.cleanup(); globalThis.window = original; }
});

test('Preferences OK saves all AI sections and closes; failed OK keeps the dialog open with its draft', async () => {
  const original = globalThis.window; globalThis.window = { addEventListener() {}, removeEventListener() {} };
  for (const failed of [false, true]) {
    const fixture = dialogFixture(failed ? async () => { throw new Error('Fixture keyring failure'); } : undefined);
    try {
      await fixture.render(); fixture.draft().updateAiConfig({ maxTokens: 2048 }); await fixture.draft().resetGuardrailPolicy('strict');
      fixture.draft().addMcpServer({ name: 'MCP', type: 'stdio', command: 'never-executed', args: [], env: {}, enabled: false });
      fixture.draft().addGlobalReviewer({ name: 'Agent' });
      let nodes = await fixture.render(); await button(nodes, 'OK').props.onClick(); nodes = await fixture.render();
      assert.equal(fixture.preferences.isPreferencesOpen, failed);
      if (failed) {
        assert.equal(fixture.saved().aiConfig.maxTokens, 4096); assert.equal(fixture.draft().aiConfig.maxTokens, 2048);
        assert.ok(nodes.some((node) => node.props.role === 'alert' && text(node).includes('Fixture keyring failure')));
      } else {
        assert.equal(fixture.saved().aiConfig.maxTokens, 2048); assert.equal(fixture.saved().mcpServers.length, 1);
        assert.equal(fixture.saved().globalReviewers.length, 1); assert.equal(fixture.saved().guardrailPolicy.mode, 'strict');
      }
    } finally { fixture.harness.cleanup(); }
  }
  globalThis.window = original;
});

test('Cancel, close and Escape discard AI-only drafts, and committing blocks overlapping Apply/OK/Cancel', async () => {
  const original = globalThis.window; const handlers = new Map();
  globalThis.window = { addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: (name) => handlers.delete(name) };
  for (const close of ['Cancel', 'close', 'Escape']) {
    const fixture = dialogFixture();
    try {
      await fixture.render(); fixture.draft().updateAiConfig({ apiKey: 'discard-secret', model: 'discard-model' });
      const nodes = await fixture.render();
      if (close === 'Escape') handlers.get('keydown')({ key: 'Escape' });
      else (close === 'close' ? nodes.find((node) => node.props['aria-label'] === 'Close Preferences') : button(nodes, 'Cancel')).props.onClick();
      await fixture.render(); assert.equal(fixture.saves(), 0); assert.equal(fixture.saved().aiConfig.model, baseline().aiConfig.model);
      assert.deepEqual(fixture.draft().apiKeyDrafts, {});
    } finally { fixture.harness.cleanup(); }
  }
  const pending = deferred(); const fixture = dialogFixture(() => pending.promise);
  try {
    await fixture.render(); fixture.draft().updateAiConfig({ model: 'chosen' }); const nodes = await fixture.render();
    const applying = button(nodes, 'Apply').props.onClick();
    await button(nodes, 'OK').props.onClick(); button(nodes, 'Cancel').props.onClick();
    assert.equal(fixture.saves(), 1); assert.equal(fixture.preferences.isPreferencesOpen, true);
    const busyNodes = await fixture.render(); assert.equal(busyNodes.find((node) => node.type === 'fieldset').props.disabled, true);
    pending.resolve(); await applying; assert.equal(fixture.preferences.isPreferencesOpen, true);
  } finally { fixture.harness.cleanup(); globalThis.window = original; }
});

test('all AI settings tabs receive draft editors; no standalone persistence or keyring writes exist in the draft factory', () => {
  const modal = readFileSync(url('features/preferences/components/PreferencesModal.tsx'), 'utf8');
  assert.match(modal, /<GuardrailsTab draftSettings=\{aiDraft\}/); assert.match(modal, /<BotReviewersTab draftSettings=\{aiDraft\}/);
  assert.equal((modal.match(/draftSettings=\{aiDraft\}/g) || []).length, 4);
  assert.match(modal, /isPendingCommit=\{draftSandboxType !== savedBaseline.sandboxType\}/);
  const source = readFileSync(url('features/ai/store/createAiPreferencesDraft.ts'), 'utf8');
  assert.doesNotMatch(source, /localStorage|invoke\(|useAiMcpStore|useBotReviewersStore|store_ai_api_key/);
});

test('Reset to Defaults is also a draft and Cancel preserves the committed AI configuration', async () => {
  const original = globalThis.window; globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const fixture = dialogFixture();
  try {
    await fixture.render(); fixture.draft().updateAiConfig({ model: 'saved-model' }); let nodes = await fixture.render();
    await button(nodes, 'Apply').props.onClick(); nodes = await fixture.render();
    button(nodes, 'Reset to default').props.onClick(); nodes = await fixture.render();
    button(nodes, 'Reset to Defaults').props.onClick(); nodes = await fixture.render();
    assert.equal(fixture.draft().aiConfig.model, baseline().aiConfig.model);
    assert.equal(fixture.saved().aiConfig.model, 'saved-model');
    button(nodes, 'Cancel').props.onClick(); await fixture.render();
    assert.equal(fixture.saved().aiConfig.model, 'saved-model'); assert.equal(fixture.saves(), 1);
  } finally { fixture.harness.cleanup(); globalThis.window = original; }
});

test('startup restores the committed guardrail policy before native hydration instead of replacing it with balanced defaults', async () => {
  const originalWindow = globalThis.window; const originalStorage = globalThis.localStorage;
  const saved = baseline(); saved.guardrailPolicy = guardrailPresets.guardrailPreset('strict');
  const values = new Map([['stage0_ai_mcp_config', JSON.stringify(saved)]]);
  let startup; const calls = []; let nativePolicy = guards.DEFAULT_GUARDRAIL_POLICY;
  globalThis.window = { setTimeout: (callback) => { startup = callback; } };
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    const { useAiMcpStore: store } = loadWithMocks(url('features/ai/store/useAiMcpStore.ts'), {
      zustand: { create }, '../constants/aiPresets': presets, '../types/guardrails': guards,
      '../constants/runtimeAvailability': availability, '../utils/resetMcpVerification': verification,
      '@tauri-apps/api/core': { isTauri: () => true, invoke: async (name, args) => {
        calls.push(name);
        if (name === 'commit_ai_preferences') { nativePolicy = args.policy; assert.deepEqual(args.apiKeys, {}); return {}; }
        if (name === 'get_guardrail_policy') return nativePolicy;
        if (name === 'get_guardrail_audit_log') return [];
        if (name === 'has_ai_api_key') return false;
        return { connected: false, available: false, auth_method: 'none' };
      } },
    });
    startup(); await new Promise((resolve) => setImmediate(resolve));
    assert.equal(store.getState().guardrailPolicy.mode, 'strict');
    assert.ok(calls.indexOf('commit_ai_preferences') < calls.indexOf('get_guardrail_policy'));
    assert.equal(JSON.parse(values.get('stage0_ai_mcp_config')).guardrailPolicy.mode, 'strict');
  } finally { globalThis.window = originalWindow; globalThis.localStorage = originalStorage; }
});

test('reloading the AI store preserves the chosen provider, auth mode, explicit model and every saved scalar preference', () => {
  const originalWindow = globalThis.window; const originalStorage = globalThis.localStorage;
  try {
    globalThis.window = { setTimeout() {} };
    for (const [provider, model] of presets.AI_PROVIDERS.map((preset) => [preset.id, preset.id === 'openai' ? 'gpt-4o' : preset.id === 'anthropic' ? 'claude-3-7-sonnet-20250219' : preset.defaultModel])) {
      const saved = baseline(); saved.aiConfig = { ...saved.aiConfig, provider, model, authMode: 'subscription_oauth', baseUrl: 'https://fixture.test/v1', temperature: 0.6, maxTokens: 2048, systemPrompt: 'My saved instructions', streamResponse: false, enableCodeReviewAssist: false };
      globalThis.localStorage = { getItem: () => JSON.stringify(saved), setItem() {} };
      const { useAiMcpStore: store } = loadWithMocks(url('features/ai/store/useAiMcpStore.ts'), {
        zustand: { create }, '../constants/aiPresets': presets, '../types/guardrails': guards,
        '../constants/runtimeAvailability': availability, '../utils/resetMcpVerification': verification,
        '@tauri-apps/api/core': { isTauri: () => true, invoke: () => assert.fail('Hydration should not run in this fixture') },
      });
      assert.deepEqual(store.getState().aiConfig, saved.aiConfig);
    }
  } finally { globalThis.window = originalWindow; globalThis.localStorage = originalStorage; }
});

test('first launch, incomplete settings and Reset use OpenAI defaults without overwriting a saved provider on load', () => {
  const originalWindow = globalThis.window; const originalStorage = globalThis.localStorage;
  const openai = presets.AI_PROVIDERS.find((provider) => provider.id === 'openai');
  try {
    globalThis.window = { setTimeout() {} };
    for (const saved of [null, {}, { mcpServers: [] }, { aiConfig: { temperature: 0.4 } }]) {
      let raw = saved === null ? null : JSON.stringify(saved);
      globalThis.localStorage = { getItem: () => raw, setItem: (_key, value) => { raw = value; } };
      const { useAiMcpStore: store } = loadWithMocks(url('features/ai/store/useAiMcpStore.ts'), {
        zustand: { create }, '../constants/aiPresets': presets, '../types/guardrails': guards,
        '../constants/runtimeAvailability': availability, '../utils/resetMcpVerification': verification,
        '@tauri-apps/api/core': { isTauri: () => false, invoke: () => assert.fail('No credentials or network access expected') },
      });
      assert.equal(store.getState().aiConfig.provider, 'openai');
      assert.equal(store.getState().aiConfig.model, openai.defaultModel);
      assert.equal(store.getState().aiConfig.baseUrl, openai.defaultBaseUrl);
      store.getState().setProvider('anthropic');
      assert.equal(store.getState().aiConfig.provider, 'anthropic');
      store.getState().resetAiConfig();
      assert.equal(store.getState().aiConfig.provider, 'openai');
      assert.equal(JSON.parse(raw).aiConfig.provider, 'openai');
    }
  } finally { globalThis.window = originalWindow; globalThis.localStorage = originalStorage; }
});

test('provider UI selects OpenAI on first launch, exposes its API key input and keeps provider changes in the draft', async () => {
  const harness = componentHarness(); const draft = createAiPreferencesDraft(baseline());
  const noop = () => {};
  const credentialCalls = [];
  const dependencies = {
    react: harness.react,
    '@tauri-apps/api/core': { isTauri: () => false, invoke: () => assert.fail('No IPC expected') },
    '../store/useAiMcpStore': { useAiMcpStore: () => ({
      aiConfig: baseline().aiConfig, apiKeysConfigured: {}, mcpServers: [], cliStatus: {}, dynamicModels: {},
      setActiveSubTab: noop, checkCopilotStatus: () => credentialCalls.push('copilot'), checkGoogleAuthStatus: () => credentialCalls.push('google'), checkChatGptAuthStatus: noop,
      detectCli: noop, fetchDynamicModels: () => credentialCalls.push('models'), loadApiKeyForProvider: () => credentialCalls.push('key'),
    }) },
    '../constants/aiPresets': presets,
    '../../../common/components/CustomSelect': { CustomSelect: () => null },
    '../../review/components/HarnessConnectionsPanel': { HarnessConnectionsPanel: () => null },
    './ChatGptDeviceCodeCard': { ChatGptDeviceCodeCard: () => null },
    './ChatGptBrowserAuthCard': { ChatGptBrowserAuthCard: () => null },
  };
  const source = readFileSync(url('features/ai/components/AiMcpTab.tsx'), 'utf8');
  for (const [, name, path] of source.matchAll(/import \{ (\w+) \} from '([^']+\/icons\/[^']+)';/g)) dependencies[path] = { [name]: () => null };
  const { AiMcpTab } = loadWithMocks(url('features/ai/components/AiMcpTab.tsx'), dependencies);
  const render = async () => componentNodes(await harness.render(AiMcpTab, {
    activeView: 'providers', draftSettings: draft.getState(), draftAiConfig: draft.getState().aiConfig,
    onUpdateAiConfig: (partial) => draft.getState().updateAiConfig(partial),
  }));
  try {
    let nodes = await render();
    assert.match(button(nodes, 'OpenAI / ChatGPT').props.className, /bg-surface1 text-text/);
    assert.ok(nodes.some((node) => node.type === 'input' && node.props.type === 'password'));
    assert.deepEqual(credentialCalls, []);
    assert.doesNotMatch(text({ props: { children: nodes } }), /Ollama runs offline/);
    button(nodes, 'Anthropic Claude').props.onClick(); nodes = await render();
    assert.match(button(nodes, 'Anthropic Claude').props.className, /bg-surface1 text-text/);
    assert.equal(draft.getState().aiConfig.provider, 'anthropic');
    assert.deepEqual(credentialCalls, []);
    button(nodes, 'Check saved API key').props.onClick(); assert.deepEqual(credentialCalls, ['key']);
    button(nodes, 'Reset').props.onClick(); nodes = await render();
    assert.equal(draft.getState().aiConfig.provider, 'openai');
    assert.match(button(nodes, 'OpenAI / ChatGPT').props.className, /bg-surface1 text-text/);
  } finally { harness.cleanup(); }
});
