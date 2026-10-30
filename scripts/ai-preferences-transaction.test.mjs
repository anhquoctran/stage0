import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const require = createRequire(import.meta.url);
const { create } = require('zustand');
const english = require('../frontend/features/i18n/locales/en.json');
const translate = (key, options = {}) => {
  const value = key.split('.').reduce((value, part) => value?.[part], english) ?? key;
  return typeof value === 'string' ? value.replace(/\{\{(\w+)\}\}/g, (match, name) => String(options[name] ?? match)) : value;
};
const url = (path) => new URL(`../frontend/${path}`, import.meta.url);
const presets = loadWithMocks(url('features/ai/constants/aiPresets.ts'), {});
const modelPresets = loadWithMocks(url('features/ai/utils/resolveAiModelPreset.ts'), { '../constants/aiPresets': presets });
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
  const originalDocument = { content: '{}', revision: 'fixture-1', path: 'fixture', migrated: false, settings: {} };
  let document = originalDocument;
  const preferenceWrites = [];
  const api = loadWithMocks(url('features/ai/services/commitAiPreferences.ts'), {
    '@tauri-apps/api/core': { isTauri: () => true, invoke: async (...args) => { calls.push(args); return handler(...args); } },
    '../store/useAiMcpStore': { useAiMcpStore: ai }, '../store/useBotReviewersStore': { useBotReviewersStore: reviewers },
    '../utils/aiPreferencesSnapshot': snapshots,
    '../../i18n/i18n': { default: { t: translate } },
    '../../preferences/services/preferencesJsonService': { preferencesJsonService: {
      load: async () => {
        if (document.loadFailure) throw new Error('fixture read failure');
        if (document.settings.ai?.aiConfig) ai.setState({ aiConfig: document.settings.ai.aiConfig });
        return document;
      },
      isCurrent: () => true,
      commit: async (request) => {
        assert.equal(request.expectedRevision, document.revision);
        calls.push(['commit_preferences_transaction', { request }]);
        const configured = await handler('commit_preferences_transaction', { request });
        preferenceWrites.push(['commit', request.patch]);
        document = { ...document, content: JSON.stringify(request.patch), revision: 'fixture-2', settings: request.patch };
        return { document, configured };
      },
      patch: async (patch, expectedRevision) => {
        assert.equal(expectedRevision, document.revision, 'The rollback snapshot and write must use the same revision');
        preferenceWrites.push(['patch', patch]);
        document = { ...document, content: JSON.stringify(patch), revision: 'fixture-2', settings: patch };
        return document;
      },
      saveText: async (content) => {
        preferenceWrites.push(['rollback', content]);
        if (document.rollbackFailure) throw new Error('fixture file rollback failure');
        document = { ...originalDocument, content, revision: 'fixture-3' };
        return document;
      },
    } },
  });
  const local = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  return { initial, ai, reviewers, calls, storage, local, preferenceWrites, getPreferenceDocument: () => document, ...api };
}

test('Apply awaits one native key/policy batch, publishes all AI sections together and persists no API secrets', async () => {
  const native = deferred(); const fixture = serviceFixture(() => native.promise); const old = globalThis.localStorage; globalThis.localStorage = fixture.local;
  try {
    const draft = createAiPreferencesDraft(fixture.initial);
    draft.getState().updateAiConfig({ apiKey: 'fixture-private-key', maxTokens: 2048 });
    await draft.getState().resetGuardrailPolicy('strict'); draft.getState().addGlobalReviewer({ name: 'Agent', enabled: true });
    const save = fixture.commitAiPreferences(draft.getState(), fixture.initial);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fixture.ai.getState().aiConfig.maxTokens, 4096); assert.equal(fixture.reviewers.getState().globalReviewers.length, 0);
    assert.equal(fixture.calls.length, 1); assert.equal(fixture.calls[0][0], 'commit_preferences_transaction');
    assert.deepEqual(fixture.calls[0][1].request.apiKeys, { openai: 'fixture-private-key' });
    assert.equal(fixture.preferenceWrites.length, 0, 'No JSON is published while native staging is pending');
    assert.doesNotMatch(JSON.stringify(fixture.calls[0][1].request.patch), /fixture-private-key|apiKeyDrafts/);
    assert.doesNotMatch([...fixture.storage.values()].join(''), /fixture-private-key|apiKeyDrafts/);
    await assert.rejects(fixture.commitAiPreferences(draft.getState(), fixture.initial), /already in progress/);
    native.resolve({ openai: true }); const saved = await save;
    assert.equal(fixture.ai.getState().aiConfig.maxTokens, 2048); assert.equal(fixture.ai.getState().guardrailPolicy.mode, 'strict');
    assert.equal(fixture.reviewers.getState().globalReviewers.length, 1); assert.equal(fixture.ai.getState().apiKeysConfigured.openai, true);
    assert.equal(saved.aiConfig.apiKey, ''); assert.doesNotMatch(JSON.stringify(fixture.ai.getState()), /fixture-private-key/);
  } finally { globalThis.localStorage = old; }
});

test('a failed preferences read aborts before any writes or credential changes', async () => {
  const fixture = serviceFixture();
  fixture.getPreferenceDocument().loadFailure = true;
  const draft = createAiPreferencesDraft(fixture.initial);
  draft.getState().updateAiConfig({ apiKey: 'pending-secret' });
  await assert.rejects(fixture.commitAiPreferences(draft.getState(), fixture.initial), /fixture read failure/);
  assert.deepEqual(fixture.preferenceWrites, []);
  assert.deepEqual(fixture.calls, []);
  assert.equal(draft.getState().apiKeyDrafts.openai, 'pending-secret');
});

test('Apply merges against the freshly loaded document before preparing its patch', async () => {
  const fixture = serviceFixture();
  const draft = createAiPreferencesDraft(fixture.initial);
  draft.getState().updateAiConfig({ model: 'user-choice' });
  fixture.getPreferenceDocument().settings = { ai: { aiConfig: { ...fixture.initial.aiConfig, maxTokens: 8192 } } };
  await fixture.commitAiPreferences(draft.getState(), fixture.initial);
  assert.equal(fixture.preferenceWrites[0][1].ai.aiConfig.maxTokens, 8192);
  assert.equal(fixture.preferenceWrites[0][1].ai.aiConfig.model, 'user-choice');
});

test('native transaction failure leaves JSON unchanged without frontend compensation and retains the draft', async () => {
  for (const rollbackFailure of [false, true]) {
    const fixture = serviceFixture(async () => { throw new Error('OS keyring unavailable'); });
    const old = globalThis.localStorage; const previous = [...fixture.storage];
    globalThis.localStorage = fixture.local;
    if (rollbackFailure) fixture.getPreferenceDocument().rollbackFailure = true;
    try {
      const draft = createAiPreferencesDraft(fixture.initial); draft.getState().updateAiConfig({ apiKey: 'retry-secret', maxTokens: 2048 });
      await assert.rejects(fixture.commitAiPreferences(draft.getState(), fixture.initial), /keyring unavailable|rollback was incomplete/);
      assert.deepEqual([...fixture.storage], previous); assert.equal(fixture.ai.getState().aiConfig.maxTokens, 4096);
      assert.equal(draft.getState().apiKeyDrafts.openai, 'retry-secret');
      assert.equal(fixture.calls.length, 1);
      assert.deepEqual(fixture.preferenceWrites, [], 'Failure must not publish a JSON patch or invoke frontend rollback');
      assert.equal(fixture.getPreferenceDocument().content, '{}');
    } finally { globalThis.localStorage = old; }
  }
});

test('MCP secret variables are stored per server in the keychain and never retained in JSON or committed state', async () => {
  const fixture = serviceFixture(async () => ({}));
  const server = { id: 'git-context', name: 'Git Context', type: 'stdio', command: 'mcp-server', args: [], env: {}, secretEnvKeys: [], enabled: true };
  fixture.initial.mcpServers = [server];
  fixture.ai.setState({ mcpServers: [server] });
  const draft = createAiPreferencesDraft(fixture.initial);
  draft.getState().updateMcpServer(server.id, {
    env: { GITHUB_TOKEN: 'ghp_sensitive-fixture' },
    secretEnvKeys: ['GITHUB_TOKEN'],
  });

  const saved = await fixture.commitAiPreferences(draft.getState(), fixture.initial);
  assert.equal(fixture.calls[0][0], 'commit_preferences_transaction');
  const request = fixture.calls[0][1].request;
  assert.deepEqual(request.apiKeys, {});
  assert.deepEqual(request.apiKeyRemovals, []);
  assert.deepEqual(request.mcpEnvSecrets, { 'git-context': { GITHUB_TOKEN: 'ghp_sensitive-fixture' } });
  assert.deepEqual(request.mcpEnvRemovals, {});
  assert.equal(request.expectedRevision, 'fixture-1');
  const persisted = fixture.preferenceWrites[0][1].ai.mcpServers[0];
  assert.deepEqual(persisted.env, {});
  assert.deepEqual(persisted.secretEnvKeys, ['GITHUB_TOKEN']);
  assert.doesNotMatch(JSON.stringify(fixture.preferenceWrites), /ghp_sensitive-fixture/);
  assert.deepEqual(fixture.ai.getState().mcpServers[0].env, {});
  assert.deepEqual(saved.mcpServers[0].env, {});
  assert.doesNotMatch(JSON.stringify(saved), /ghp_sensitive-fixture/);
});

test('UI and output languages join the same JSON patch as AI preferences without touching the keychain', async () => {
  const fixture = serviceFixture();
  const saved = { appearance: { language: 'en' }, ai: { agentOutputLanguage: 'follow-app' } };
  Object.assign(fixture.getPreferenceDocument(), { settings: saved, content: JSON.stringify(saved) });
  const draft = createAiPreferencesDraft(fixture.initial);
  draft.getState().updateAiConfig({ maxTokens: 8192 });
  let validated = false;
  await fixture.commitAiPreferences(draft.getState(), fixture.initial, {
    appearance: { language: 'vi' }, ai: { agentOutputLanguage: 'ja' },
  }, (current) => {
    validated = true;
    assert.equal(current.appearance.language, 'en');
    assert.equal(fixture.preferenceWrites.length, 0, 'Validate the fresh document before writing');
  });
  assert.equal(validated, true);
  assert.equal(fixture.preferenceWrites.length, 1);
  const patch = fixture.preferenceWrites[0][1];
  assert.equal(patch.appearance.language, 'vi');
  assert.equal(patch.ai.agentOutputLanguage, 'ja');
  assert.equal(patch.ai.aiConfig.maxTokens, 8192, 'Output language does not replace the AI configuration');
  assert.equal(fixture.calls.length, 1, 'Languages join the same native transaction');
  assert.deepEqual(fixture.calls[0][1].request.apiKeys, {});
  assert.deepEqual(fixture.calls[0][1].request.mcpEnvSecrets, {});
});

test('a rejected latest-document validation performs no preference or credential writes', async () => {
  const fixture = serviceFixture();
  const draft = createAiPreferencesDraft(fixture.initial);
  draft.getState().updateAiConfig({ apiKey: 'pending-secret' });
  await assert.rejects(fixture.commitAiPreferences(draft.getState(), fixture.initial,
    { appearance: { language: 'vi' } }, () => { throw Error('Language changed in another window'); }), /another window/);
  assert.equal(fixture.preferenceWrites.length, 0);
  assert.equal(fixture.calls.length, 0);
  assert.equal(draft.getState().apiKeyDrafts.openai, 'pending-secret');
});

test('a failed native preparation leaves both language fields and all JSON unchanged', async () => {
  const fixture = serviceFixture(async () => { throw Error('Keychain denied'); });
  const previous = { appearance: { language: 'en' }, ai: { agentOutputLanguage: 'fr' } };
  const content = JSON.stringify(previous);
  Object.assign(fixture.getPreferenceDocument(), { content, settings: previous });
  const draft = createAiPreferencesDraft(fixture.initial);
  draft.getState().updateAiConfig({ apiKey: 'pending-secret' });
  await assert.rejects(fixture.commitAiPreferences(draft.getState(), fixture.initial, {
    appearance: { language: 'ar' }, ai: { agentOutputLanguage: 'follow-app' },
  }), /Keychain denied/);
  assert.equal(fixture.calls[0][1].request.patch.ai.agentOutputLanguage, 'follow-app');
  assert.deepEqual(fixture.preferenceWrites, []);
  assert.equal(fixture.getPreferenceDocument().content, content);
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0][1].appearance, undefined);
  assert.equal(fixture.calls[0][1].agentOutputLanguage, undefined);
  assert.equal(draft.getState().apiKeyDrafts.openai, 'pending-secret', 'Draft remains available for retry');
});

test('removing the last MCP secret joins its server removal in the native transaction', async () => {
  const fixture = serviceFixture(async () => ({}));
  const server = { id: 'git-context', name: 'Git Context', type: 'stdio', command: 'mcp-server', args: [], env: {}, secretEnvKeys: ['GITHUB_TOKEN'], enabled: true };
  fixture.initial.mcpServers = [server];
  fixture.ai.setState({ mcpServers: [server] });
  const draft = createAiPreferencesDraft(fixture.initial);
  draft.getState().deleteMcpServer(server.id);

  await fixture.commitAiPreferences(draft.getState(), fixture.initial);
  assert.deepEqual(fixture.calls[0][1].request.mcpEnvSecrets, {});
  assert.deepEqual(fixture.calls[0][1].request.mcpEnvRemovals, { 'git-context': ['GITHUB_TOKEN'] });
  assert.deepEqual(fixture.preferenceWrites[0][1].ai.mcpServers, []);
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
  const themeState = { themeMode: 'system', theme: 'dark' };
  const useThemeStore = Object.assign(() => themeState, { setState: (value) => Object.assign(themeState, typeof value === 'function' ? value(themeState) : value) });
  const gitState = { activeSandboxType: 'in_memory', showToast() {}, refreshDiff() {} };
  const useGitStore = Object.assign(() => gitState, { getState: () => gitState, setState: (value) => Object.assign(gitState, typeof value === 'function' ? value(gitState) : value) });
  const gitBinaryState = { activeBinaryId: 'system', activeBinaryPath: 'git', binaries: [], fetchActiveBinary: async () => ({ id: 'system', path: 'git' }) };
  const useGitBinaryStore = Object.assign(() => gitBinaryState, { getState: () => gitBinaryState, setState: (value) => Object.assign(gitBinaryState, typeof value === 'function' ? value(gitBinaryState) : value) });
  const usePreferencesStore = Object.assign(() => preferences, { getState: () => preferences, setState: (value) => Object.assign(preferences, typeof value === 'function' ? value(preferences) : value) });
  const dependencies = {
    react: harness.react,
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '../../i18n/i18n': { default: { t: translate } },
    '../../../core/services/runtime/applicationRuntime': { getApplicationServices: () => ({ platform: { capabilities: { backend: false, preferencesFile: false } } }) },
    '../store/usePreferencesStore': { usePreferencesStore, checkFontLigaturesSupport: () => true, applyViewerFontToDocument() {}, DEFAULT_VIEWER_FONT_SETTINGS: preferences },
    '../../../core/store/useThemeStore': { useThemeStore, resolveTheme: () => 'dark', applyThemeToDocument() {}, persistThemeMode() {} },
    '../utils/applyUiFontToDocument': { applyUiFontToDocument() {} },
    '../utils/applyMarkdownFontToDocument': { applyMarkdownFontToDocument() {} },
    '../constants/fonts': { SUPPORTED_FONTS: [{ fontFamilyName: 'Fira Code' }] },
    '../../../common/utils/shortcuts': { formatShortcutText: (s) => s },
    '../../git/store/useGitStore': { useGitStore },
    '../../git/store/useGitBinaryStore': { useGitBinaryStore },
    '../../ai/store/createAiPreferencesDraft': { createAiPreferencesDraft: (snapshot) => { draftStore = createAiPreferencesDraft(snapshot); return Object.assign(() => draftStore.getState(), draftStore); } },
    '../../ai/services/commitAiPreferences': { captureAiPreferences: () => structuredClone(committed), commitAiPreferences: async (draft, base) => {
      saves++; if (commitHandler) await commitHandler(); committed = snapshots.mergeAiPreferences(draft, base, committed); return committed;
    } },
    '../../ai/utils/aiPreferencesSnapshot': snapshots, '../../ai/constants/aiPresets': presets, '../../ai/types/guardrails': guards, '../../ai/constants/botPresets': bots,
    '../../ai/components/AiMcpTab': { AiMcpTab: child },
    '../../ai/components/GuardrailsTab': { GuardrailsTab: child }, '../../ai/components/BotReviewersTab': { BotReviewersTab: child }, '../../ai/components/SandboxTab': { SandboxTab: child },
    '../../credentials/components/GitCredentialsTab': { GitCredentialsTab: child }, '../../git/components/GitBinaryTab': { GitBinaryTab: child }, '../../notifications/components/NotificationsTab': { NotificationsTab: child },
    './SettingRow': { SettingRow: child }, './ZedSwitch': { ZedSwitch: child },
    './PreferencesJsonEditor': { PreferencesJsonEditor: child },
    '../constants/botPresets': bots,
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
      if (close === 'Escape') handlers.get('keydown')({ key: 'Escape', preventDefault() {} });
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
    handlers.get('keydown')({ key: 'Escape', preventDefault() {} });
    assert.equal(fixture.saves(), 1); assert.equal(fixture.preferences.isPreferencesOpen, true);
    const busyNodes = await fixture.render(); assert.equal(busyNodes.find((node) => node.type === 'fieldset').props.disabled, true);
    pending.resolve(); await applying; assert.equal(fixture.preferences.isPreferencesOpen, true);
  } finally { fixture.harness.cleanup(); globalThis.window = original; }
});

test('all AI settings tabs receive draft editors; no standalone persistence or keyring writes exist in the draft factory', () => {
  const modal = readFileSync(url('features/preferences/components/PreferencesTabContainer.tsx'), 'utf8');
  assert.match(modal, /<GuardrailsTab\s+draftSettings=\{aiDraft\}/); assert.match(modal, /<BotReviewersTab\s+draftSettings=\{aiDraft\}/);
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

test('startup reads the native committed policy without writing stale WebView preferences', async () => {
  const originalWindow = globalThis.window; const originalStorage = globalThis.localStorage;
  const saved = baseline(); saved.guardrailPolicy = guardrailPresets.guardrailPreset('strict');
  const values = new Map([['stage0_ai_mcp_config', JSON.stringify(saved)]]);
  let startup; const calls = []; let nativePolicy = saved.guardrailPolicy;
  globalThis.window = { setTimeout: (callback) => { startup = callback; } };
  globalThis.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    const { useAiMcpStore: store } = loadWithMocks(url('features/ai/store/useAiMcpStore.ts'), {
      zustand: { create }, '../constants/aiPresets': presets, '../types/guardrails': guards,
      '../constants/botPresets': bots,
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
    assert.ok(calls.includes('get_guardrail_policy'));
    assert.ok(!calls.includes('commit_ai_preferences'));
    assert.ok(!calls.includes('patch_preferences'));
    assert.equal(JSON.parse(values.get('stage0_ai_mcp_config')).guardrailPolicy.mode, 'strict');
  } finally { globalThis.window = originalWindow; globalThis.localStorage = originalStorage; }
});

test('reloading the AI store preserves provider/model/preferences and discards retired authentication fields', () => {
  const originalWindow = globalThis.window; const originalStorage = globalThis.localStorage;
  try {
    globalThis.window = { setTimeout() {} };
    for (const [provider, model] of presets.AI_PROVIDERS.map((preset) => [preset.id, preset.id === 'openai' ? 'gpt-4o' : preset.id === 'anthropic' ? 'claude-3-7-sonnet-20250219' : preset.defaultModel])) {
      const saved = baseline(); saved.aiConfig = { ...saved.aiConfig, provider, model, authMode: 'subscription_oauth', baseUrl: 'https://fixture.test/v1', temperature: 0.6, maxTokens: 2048, reviewerInstructions: 'My saved instructions', streamResponse: false, enableCodeReviewAssist: false };
      globalThis.localStorage = { getItem: () => JSON.stringify(saved), setItem() {} };
      const { useAiMcpStore: store } = loadWithMocks(url('features/ai/store/useAiMcpStore.ts'), {
        zustand: { create }, '../constants/aiPresets': presets, '../types/guardrails': guards,
        '../constants/botPresets': bots,
        '../constants/runtimeAvailability': availability, '../utils/resetMcpVerification': verification,
        '@tauri-apps/api/core': { isTauri: () => true, invoke: () => assert.fail('Hydration should not run in this fixture') },
      });
      const { authMode, ...expected } = saved.aiConfig;
      assert.deepEqual(store.getState().aiConfig, expected);
      assert.equal('authMode' in store.getState().aiConfig, false);
      assert.equal('cliType' in store.getState().aiConfig, false);
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
      assert.equal(globalThis.window.__STAGE0_PREFERENCES__.ai.aiConfig.provider, 'openai');
    }
  } finally { globalThis.window = originalWindow; globalThis.localStorage = originalStorage; }
});

test('provider setup saves connection details without requiring model discovery', async () => {
  const harness = componentHarness(); const draft = createAiPreferencesDraft(baseline());
  const noop = () => {};
  const credentialCalls = [];
  const modelFetches = [];
  const dependencies = {
    react: harness.react,
    'react-i18next': { useTranslation: () => ({ t: translate }) },
    '../../i18n/i18n': { default: { t: translate } },
    '@tauri-apps/api/core': { isTauri: () => false, invoke: () => assert.fail('No IPC expected') },
    '../store/useAiMcpStore': { useAiMcpStore: () => ({
      aiConfig: baseline().aiConfig, apiKeysConfigured: {}, mcpServers: [], cliStatus: {}, dynamicModels: {},
      setActiveSubTab: noop, checkCopilotStatus: () => credentialCalls.push('copilot'), checkGoogleAuthStatus: () => credentialCalls.push('google'), checkChatGptAuthStatus: noop,
      detectCli: noop, fetchDynamicModels: (config) => {
        modelFetches.push(config);
        return Promise.resolve({ success: true, count: 1, models: [{ id: `api-${config.provider}`, name: `API ${config.provider} model` }] });
      }, loadApiKeyForProvider: (provider) => credentialCalls.push(['key', provider]),
    }) },
    '../constants/aiPresets': presets,
    '../constants/botPresets': bots,
    '../utils/resolveAiModelPreset': modelPresets,
    '../utils/getProviderIcon': { getProviderIcon: () => () => null },
    '../utils/botRolePrompts': { getBotRolePrompt: () => 'Fixture prompt' },
    './AiModelExecutionOptions': { AiModelExecutionOptions: () => null },
    '../../../common/components/CustomSelect': { CustomSelect: () => null },
    '../../review/components/HarnessConnectionsPanel': { HarnessConnectionsPanel: () => null },
  };
  for (const name of ['Plus', 'Trash2', 'Sparkles', 'X', 'AlertCircle', 'Check', 'Eye', 'EyeOff', 'ShieldCheck', 'CheckCircle2', 'ExternalLink', 'RefreshCw', 'RotateCcw', 'ChevronDown', 'ArrowLeft']) {
    dependencies[`../../../common/components/icons/${name}`] = { [name]: () => null };
  }
  const source = readFileSync(url('features/ai/components/AiMcpTab.tsx'), 'utf8');
  for (const [, name, path] of source.matchAll(/import \{ (\w+) \} from '([^']+\/icons\/[^']+)';/g)) dependencies[path] = { [name]: () => null };
  const { AiMcpTab } = loadWithMocks(url('features/ai/components/AiMcpTab.tsx'), dependencies);
  const render = async () => componentNodes(await harness.render(AiMcpTab, {
    activeView: 'providers', draftSettings: draft.getState(), draftAiConfig: draft.getState().aiConfig,
    onUpdateAiConfig: (partial) => draft.getState().updateAiConfig(partial),
  }));
  try {
    let nodes = await render();
    assert.equal(draft.getState().aiConfig.provider, 'openai');
    assert.deepEqual(draft.getState().aiConfig.configuredProviders, []);
    assert.deepEqual(credentialCalls, []);
    assert.doesNotMatch(text({ props: { children: nodes } }), /Ollama runs offline/);
    for (const provider of ['openai', 'anthropic']) {
      button(nodes, 'Add provider').props.onClick(); nodes = await render();
      const select = nodes.find((node) => node.props?.id === 'llm-provider-select');
      assert.equal(select.props.value, provider);
      const input = nodes.find((node) => node.props?.id === 'llm-provider-api-key');
      assert.equal(input.props.type, 'password');
      input.props.onChange({ target: { value: 'fixture-draft-key' } }); nodes = await render();
      assert.equal(nodes.some((node) => node.props?.id === 'llm-provider-model'), false);
      nodes.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }); nodes = await render();
      assert.equal(draft.getState().aiConfig.provider, provider);
      assert.ok(draft.getState().aiConfig.configuredProviders.includes(provider));
      const row = nodes.find((node) => node.type === 'tr' && text(node).includes(provider === 'openai' ? 'OpenAI / ChatGPT' : 'Anthropic Claude'));
      assert.match(row.props.className, /bg-surface0\/70/);
      assert.deepEqual(credentialCalls, []);
      assert.deepEqual(modelFetches, []);
    }
    assert.equal(draft.getState().aiConfig.provider, 'anthropic');
    assert.equal(baseline().aiConfig.provider, 'openai');
    const row = nodes.find((node) => node.type === 'tr' && text(node).includes('Anthropic Claude'));
    button(componentNodes(row), 'Configure').props.onClick(); nodes = await render();
    button(nodes, 'Check saved API key').props.onClick(); assert.deepEqual(credentialCalls, [['key', 'anthropic']]);
    button(nodes, 'Reset').props.onClick(); nodes = await render();
    assert.equal(draft.getState().aiConfig.provider, 'openai');
    assert.deepEqual(draft.getState().aiConfig.configuredProviders, []);
    assert.deepEqual(draft.getState().apiKeyDrafts, {});
  } finally { harness.cleanup(); }
});
