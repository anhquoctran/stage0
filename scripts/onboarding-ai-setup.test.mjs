import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';

const url = (path) => new URL(`../frontend/features/onboarding/${path}`, import.meta.url);
const { DEFAULT_AI_CONFIG } = loadWithMocks(new URL('../frontend/features/ai/constants/aiPresets.ts', import.meta.url), {});
const { onboardingAiConnections } = loadWithMocks(url('services/onboardingAiStatus.ts'), {});
const agent = { id: 'test-acp', name: 'Test agent', command: 'test-agent', args: [], source: 'custom' };
const snapshot = () => ({ aiConfig: structuredClone(DEFAULT_AI_CONFIG), mcpServers: [], externalAgents: [], globalReviewers: [], guardrailPolicy: {} });

test('setup requires an explicit saved provider with model/endpoint/credentials, or a saved ACP launch', () => {
  const state = { ...snapshot(), apiKeysConfigured: {} };
  assert.deepEqual(onboardingAiConnections(state), [], 'Default model and endpoint do not count');
  state.aiConfig.configuredProviders = ['openai'];
  state.aiConfig.apiKey = 'unsaved-secret';
  assert.deepEqual(onboardingAiConnections(state), [], 'Plaintext draft is never proof of saved credentials');
  state.apiKeysConfigured.openai = true;
  assert.equal(onboardingAiConnections(state).length, 1);
  state.aiConfig.model = ' '; assert.deepEqual(onboardingAiConnections(state), []);
  state.aiConfig.model = 'test'; state.aiConfig.baseUrl = 'file:///tmp';
  assert.deepEqual(onboardingAiConnections(state), []);
  state.aiConfig.configuredProviders = ['ollama']; state.aiConfig.provider = 'ollama';
  state.aiConfig.baseUrl = 'http://localhost:11434';
  assert.deepEqual(onboardingAiConnections(state), ['Ollama (Local LLM)']);
  state.aiConfig.configuredProviders = []; state.externalAgents = [agent];
  assert.deepEqual(onboardingAiConnections(state), ['Test agent (ACP)']);
  state.externalAgents = [{ ...agent, command: '' }]; assert.deepEqual(onboardingAiConnections(state), []);
  state.externalAgents = [{ ...agent, args: [null] }]; assert.deepEqual(onboardingAiConnections(state), []);
});

test('AI setup drafts do not unlock completion; failed saves retain drafts and successful commits rebase them', async (t) => {
  const runner = hookHarness(), state = { ...snapshot(), apiKeysConfigured: {}, apiKeyCheckError: null };
  const checks = []; let commits = 0, fail = true, release;
  state.loadApiKeyForProvider = async (id) => { checks.push(id); state.apiKeysConfigured[id] = true; };
  const store = () => state; store.getState = () => state;
  const capture = () => structuredClone(Object.fromEntries(Object.entries(snapshot()).map(([key]) => [key, state[key]])));
  const { useOnboardingAiSetup } = loadWithMocks(url('hooks/useOnboardingAiSetup.ts'), {
    react: runner.react,
    '../../ai/store/useAiMcpStore': { useAiMcpStore: store },
    '../../ai/services/commitAiPreferences': {
      captureAiPreferences: capture,
      commitAiPreferences: async (draft) => {
        commits++; if (release) await new Promise((resolve) => { release.resolve = resolve; });
        if (fail) throw Error('Keychain denied');
        const clean = structuredClone({ ...snapshot(), aiConfig: { ...draft.aiConfig, apiKey: '' }, externalAgents: draft.externalAgents });
        Object.assign(state, clean); return clean;
      },
    },
  });
  t.after(() => runner.cleanup());
  let setup = runner.render(useOnboardingAiSetup);
  assert.equal(setup.canFinish(), false); assert.deepEqual(checks, [], 'No startup keychain prompts');
  setup.draft.updateExternalAgents([agent]); setup = runner.render(useOnboardingAiSetup);
  assert.equal(setup.hasChanges, true); assert.equal(setup.canFinish(), false);
  await setup.save(); setup = runner.render(useOnboardingAiSetup);
  assert.match(setup.error, /Keychain denied/); assert.equal(setup.hasChanges, true);
  assert.equal(setup.canFinish(), false); assert.deepEqual(setup.draft.externalAgents, [agent]);
  fail = false; release = {};
  const pending = setup.save(); await setup.save(); assert.equal(commits, 2, 'Single-flight save');
  assert.equal(setup.canFinish(), false); release.resolve(); await pending;
  setup = runner.render(useOnboardingAiSetup);
  assert.equal(setup.error, null); assert.equal(setup.hasChanges, false); assert.equal(setup.canFinish(), true);
  setup.draft.updateExternalAgents([]); setup = runner.render(useOnboardingAiSetup);
  assert.equal(setup.canFinish(), false, 'Pending removal must be saved or discarded');
  setup.discard(); setup = runner.render(useOnboardingAiSetup); assert.equal(setup.canFinish(), true);
  state.externalAgents = []; assert.equal(setup.canFinish(), false, 'Completion reads live committed configuration');
  state.aiConfig.configuredProviders = ['openai'];
  await setup.checkSavedKeys(); assert.deepEqual(checks, ['openai']);
  setup = runner.render(useOnboardingAiSetup); assert.equal(setup.canFinish(), true);
  state.apiKeysConfigured.openai = false; assert.equal(setup.canFinish(), false);
});

test('Skip, Close, Escape and jumping to the final slide cannot bypass required AI setup', async (t) => {
  const runner = componentHarness(), stored = new Map(), handlers = new Map();
  const previousWindow = globalThis.window, previousStorage = globalThis.localStorage;
  globalThis.window = { location: { search: '' }, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: (name) => handlers.delete(name) };
  globalThis.localStorage = { setItem: (key, value) => stored.set(key, value) };
  t.after(() => { runner.cleanup(); globalThis.window = previousWindow; globalThis.localStorage = previousStorage; });
  let ready = false, completed = 0, saves = 0, repoActions = 0;
  const { FirstLaunchWelcome } = loadWithMocks(url('components/FirstLaunchWelcome.tsx'), {
    react: runner.react,
    '@tauri-apps/api/core': { invoke: async () => {} },
    '../../../common/utils/shortcuts': { isMacOS: () => false },
    '../../../common/components/icons/ArrowRight': { ArrowRight: () => null },
    '../../../common/components/icons/X': { X: () => null },
    '../../../common/components/AppLogo': { AppLogo: () => null },
    '../../git/store/useGitStore': { useGitStore: { getState: () => ({ openRepoDialog: () => repoActions++, setIsCloneModalOpen: () => repoActions++ }) } },
    './BranchArtwork': { BranchArtwork: () => null }, './CompareArtwork': { CompareArtwork: () => null },
    './ReviewArtwork': { ReviewArtwork: () => null }, './WelcomeSettingsPanel': { WelcomeSettingsPanel: () => null },
    './WelcomeSettingsPreview': { WelcomeSettingsPreview: () => null }, './WelcomeAiSetup': { WelcomeAiSetup: () => null },
    '../hooks/useOnboardingPreferences': { useOnboardingPreferences: () => ({ settings: {}, setSettings() {}, isSaving: false, saveError: null, reload() {}, save: async () => { saves++; return true; } }) },
    '../hooks/useOnboardingAiSetup': { useOnboardingAiSetup: () => ({ connections: ready ? ['Saved ACP'] : [], busy: false, canFinish: () => ready }) },
  });
  const render = async () => componentNodes(await runner.render(FirstLaunchWelcome, { onComplete: () => completed++ }));
  const button = (nodes, name) => nodes.find((node) => node.type === 'button' && node.props.children.flat().some((child) => typeof child === 'string' && child.trim() === name));
  let nodes = await render();
  for (let slide = 0; slide < 3; slide++) {
    assert.equal(button(nodes, 'Set up AI'), undefined, 'Intro screens must not show a redundant AI setup action');
    assert.equal(button(nodes, 'Skip tour'), undefined, 'Skipping stays unavailable until AI is configured');
    const next = button(nodes, slide === 2 ? "Let's get started" : 'Next');
    assert.ok(next, 'Every introduction slide must lead toward required AI setup');
    next.props.onClick(); nodes = await render();
  }
  assert.ok(nodes.some((node) => node.type === 'h1' && node.props.children.includes('Set up your AI connection')));
  assert.equal(button(nodes, 'Next').props.disabled, true); button(nodes, 'Next').props.onClick();
  await nodes.find((node) => node.props['aria-label'] === 'Close welcome guide').props.onClick();
  handlers.get('keydown')({ key: 'Escape', preventDefault() {} });
  nodes.find((node) => node.props['aria-label']?.startsWith('Go to slide 9:')).props.onClick(); nodes = await render();
  await button(nodes, 'Open a repository').props.onClick(); nodes = await render();
  assert.equal(stored.size, 0); assert.equal(saves, 0); assert.equal(completed, 0); assert.equal(repoActions, 0);
  ready = true; nodes = await render(); assert.equal(button(nodes, 'Next').props.disabled, false);
  await button(nodes, 'Skip tour').props.onClick();
  assert.equal(completed, 1); assert.equal(saves, 1); assert.equal(stored.get('stage0_first_launch_welcome_v1'), 'completed');
});
