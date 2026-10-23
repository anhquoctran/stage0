import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHarness } from './helpers/hookHarness.mjs';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const load = (owner, dependencies) => loadWithMocks(new URL(`../frontend/${owner}`, import.meta.url), dependencies);
const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('aggregate form fields preserve neighbors, functional updates and stable setters', () => {
  const runner = hookHarness();
  const { useFormDraft } = load('common/hooks/useFormDraft.ts', { react: runner.react });
  let initialized = 0;
  const initial = () => { initialized++; return { name: 'first', count: 0 }; };
  let form = runner.render(useFormDraft, initial);
  const setField = form.setField;
  setField('name', 'edited');
  setField('count', (previous) => previous + 1);
  setField('count', (previous) => previous + 1);
  form = runner.render(useFormDraft, initial);
  assert.deepEqual(form.value, { name: 'edited', count: 2 });
  assert.equal(form.setField, setField);
  assert.equal(initialized, 1);
});

test('reviewer form keeps create/edit payloads, model capability checks and ACP consent', () => {
  const runner = hookHarness();
  const created = [], updated = [];
  const config = { provider: 'openai', model: 'chosen', baseUrl: 'https://example.test' };
  const props = {
    globalAiConfig: config,
    dynamicModels: { openai: [{ id: 'chosen', name: 'Chosen', reasoningEfforts: ['low'], supportsFastMode: false }] },
    externalAgents: [{ id: 'agent' }],
    addGlobalReviewer: (value) => created.push(value),
    updateGlobalReviewer: (...value) => updated.push(value),
  };
  const { useReviewerBotForm } = load('features/ai/components/useReviewerBotForm.ts', { react: runner.react });
  let form = runner.render(useReviewerBotForm, props);
  form.handleOpenAdd();
  form = runner.render(useReviewerBotForm, props);
  form.setFormName(' New bot ');
  form.setFormProvider('openai');
  form.setFormModel('chosen');
  form.setFormReasoningEffort('high');
  form.setFormFastMode(true);
  form = runner.render(useReviewerBotForm, props);
  form.handleSaveForm({ preventDefault() {} });
  assert.equal(created[0].name, 'New bot');
  assert.equal(created[0].reasoningEffort, undefined);
  assert.equal(created[0].fastMode, undefined);
  assert.equal(created[0].enabled, true);
  form.handleOpenEdit({ ...created[0], id: 'existing', acpAgentId: 'agent', allowAcpSourceTransfer: true, acpConfigOptions: { effort: 'high' } });
  form = runner.render(useReviewerBotForm, props);
  form.handleSaveForm({ preventDefault() {} });
  assert.equal(updated[0][0], 'existing');
  assert.equal(updated[0][1].acpAgentId, 'agent');
  assert.equal(updated[0][1].allowAcpSourceTransfer, true);
  assert.deepEqual(updated[0][1].acpConfigOptions, { effort: 'high' });
  assert.equal(updated[0][1].provider, undefined);
  assert.equal('enabled' in updated[0][1], false);
});

test('clone destination ignores late home lookups and stale native joins', async (t) => {
  const runner = hookHarness();
  t.after(() => runner.cleanup());
  const home = deferred();
  const joins = [];
  const { useCloneDestination } = load('features/git/hooks/useCloneDestination.ts', {
    react: runner.react,
    '@tauri-apps/api/path': { homeDir: () => home.promise },
    '../services/resolveCloneDestination': { resolveCloneDestination: (...args) => {
      const result = deferred(); joins.push({ args, ...result }); return result.promise;
    } },
  });
  const props = { isCloneModalOpen: true, setErrorMessage() {}, pickCloneFolder: async () => '/chosen' };
  let state = runner.render(useCloneDestination, props);
  await state.handleBrowseFolder();
  state = runner.render(useCloneDestination, props);
  home.resolve('/home/user');
  await tick();
  state = runner.render(useCloneDestination, props);
  assert.equal(state.parentDir, '/chosen');
  state.setRepoName('old');
  state = runner.render(useCloneDestination, props);
  const old = joins.at(-1);
  state.setRepoName('new');
  state = runner.render(useCloneDestination, props);
  const latest = joins.at(-1);
  latest.resolve('/chosen/new');
  await tick();
  old.resolve('/chosen/old');
  await tick();
  state = runner.render(useCloneDestination, props);
  assert.equal(state.destinationPath, '/chosen/new');
});

test('ACP account hook auto-checks once and rejects results for a previously selected agent', async (t) => {
  const runner = hookHarness();
  t.after(() => runner.cleanup());
  const requests = [], errors = [];
  const { useAcpAgentAccount } = load('features/ai/components/useAcpAgentAccount.ts', {
    react: runner.react,
    '@tauri-apps/api/core': { isTauri: () => true, invoke(command, args) {
      assert.equal(command, 'acp_agent_connection_info');
      const result = deferred(); requests.push({ args, ...result }); return result.promise;
    } },
  });
  const props = { detailAgent: { id: 'first' }, setError: (value) => errors.push(value), setBusyId() {}, setNotice() {} };
  runner.render(useAcpAgentAccount, props);
  runner.render(useAcpAgentAccount, props);
  assert.equal(requests.length, 1);
  props.detailAgent = { id: 'second' };
  runner.render(useAcpAgentAccount, props);
  const info = (email) => ({ authMethods: [], authStatus: { kind: 'account', account: { email } }, supportsAuthStatus: true, agentInfo: null });
  requests[1].resolve(info('new@example.test'));
  await tick();
  requests[0].resolve(info('stale@example.test'));
  await tick();
  const state = runner.render(useAcpAgentAccount, props);
  assert.equal(state.authStatus.account.email, 'new@example.test');
  assert.equal(state.isCheckingAuth, false);
  assert.ok(errors.every((value) => value === null));
});

test('pure graph layout preserves merge lanes without mutating commits', () => {
  const { buildGitGraphLayout } = load('features/git/utils/buildGitGraphLayout.ts', {});
  const commits = [{ hash: 'merge', parents: ['left', 'right'] }, { hash: 'left', parents: ['base'] }, { hash: 'right', parents: ['base'] }, { hash: 'base', parents: [] }];
  const original = structuredClone(commits);
  const layout = buildGitGraphLayout(commits);
  assert.deepEqual(layout.rows.map((row) => row.lane), [0, 0, 1, 0]);
  assert.deepEqual(layout.rows.map((row) => row.parentLanes), [[0, 1], [0], [0], []]);
  assert.equal(layout.laneCount, 2);
  assert.deepEqual(commits, original);
  assert.deepEqual(buildGitGraphLayout([]), { rows: [], laneCount: 1 });
});

test('Preferences session seeds drafts once per opening and does not overwrite unsaved edits', async () => {
  const runner = hookHarness();
  const replacements = [], baselines = [], tabs = [];
  const snapshot = { aiConfig: { provider: 'openai', model: 'saved' } };
  const { usePreferencesDraftSession } = load('features/preferences/hooks/usePreferencesDraftSession.ts', {
    react: runner.react,
    '../../ai/services/commitAiPreferences': { captureAiPreferences: () => snapshot },
  });
  const props = {
    storedThemeMode: 'system', storedFontFamily: 'Original', storedFontSize: 13,
    storedIsBold: false, storedIsItalic: false, storedIsUnderline: false,
    storedLineSpacing: 1.5, storedEnableLigatures: true, storedShowInlineBlame: true,
    storedSandboxType: 'in_memory', storedGitBinaryId: 'git', storedGitBinaryPath: '/git',
    storedAiConfig: snapshot.aiConfig, isPreferencesOpen: false,
    aiDraftStore: { getState: () => ({ replace: (value) => replacements.push(value) }) },
    setAiBaseline: (value) => baselines.push(value), setApplyError() {},
    fetchActiveBinary: async () => ({ id: 'git', path: '/git' }),
    setSearchQuery() {}, setActiveTab: (value) => tabs.push(value), setExpandedGroups() {},
  };
  runner.render(usePreferencesDraftSession, props);
  assert.equal(replacements.length, 0);
  props.isPreferencesOpen = true;
  runner.render(usePreferencesDraftSession, props);
  await tick();
  let state = runner.render(usePreferencesDraftSession, props);
  state.setDraftFontFamily('Unsaved');
  props.storedFontFamily = 'New saved font';
  state = runner.render(usePreferencesDraftSession, props);
  assert.equal(state.draftFontFamily, 'Unsaved');
  assert.equal(replacements.length, 1);
  props.isPreferencesOpen = false;
  runner.render(usePreferencesDraftSession, props);
  assert.equal(replacements.length, 2);
  assert.deepEqual(tabs, [null]);
  props.isPreferencesOpen = true;
  runner.render(usePreferencesDraftSession, props);
  await tick();
  state = runner.render(usePreferencesDraftSession, props);
  assert.equal(state.draftFontFamily, 'New saved font');
  assert.equal(baselines.at(-1), snapshot);
});

test('provider transport uses the saved native credential and never sends an unsaved key', async () => {
  const requests = [];
  const { checkAiProviderConnection } = load('features/ai/services/checkAiProviderConnection.ts', {
    '@tauri-apps/api/core': { isTauri: () => true, invoke: async (...args) => {
      requests.push(args); return { success: true, message: 'Actual provider response' };
    } },
  });
  const config = { provider: 'openai', model: 'chosen', baseUrl: 'https://example.test', apiKey: '', reasoningEffort: 'high', fastMode: true };
  const result = await checkAiProviderConnection(config, Date.now());
  assert.equal(result.success, true);
  assert.equal(requests[0][0], 'test_ai_review_provider');
  assert.deepEqual(requests[0][1].request, {
    sessionId: 'connection-check', provider: 'openai', authMode: 'api_key',
    model: 'chosen', baseUrl: 'https://example.test', instructions: '', allowRemote: true,
    reasoningEffort: 'high', fastMode: true,
  });
  const blocked = await checkAiProviderConnection({ ...config, apiKey: 'unsaved-secret' }, Date.now());
  assert.equal(blocked.success, false);
  assert.equal(requests.length, 1);
  assert.equal(JSON.stringify(requests).includes('unsaved-secret'), false);
});
