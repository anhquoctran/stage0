import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';
import { hookHarness } from './helpers/hookHarness.mjs';

const url = (path) => new URL(`../frontend/features/onboarding/${path}`, import.meta.url);
const { DEFAULT_AI_CONFIG } = loadWithMocks(new URL('../frontend/features/ai/constants/aiPresets.ts', import.meta.url), {});
const { onboardingAiConnections } = loadWithMocks(url('services/onboardingAiStatus.ts'), {});
const agent = { id: 'test-acp', name: 'Test agent', command: 'test-agent', args: [], source: 'custom' };
const snapshot = () => ({ aiConfig: structuredClone(DEFAULT_AI_CONFIG), mcpServers: [], externalAgents: [], globalReviewers: [{ id: 'first-reviewer', name: 'First reviewer', enabled: true, isBuiltin: false }], guardrailPolicy: {} });

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
    '../../ai/store/useBotReviewersStore': { useBotReviewersStore: store },
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

test('WelcomeAiSetup auto-saves provider and ACP changes without a manual Save AI setup button', async (t) => {
  const runner = componentHarness();
  t.after(() => runner.cleanup());
  let saves = 0;
  let capturedProviderProps = null;
  let capturedAcpProps = null;
  const { WelcomeAiSetup } = loadWithMocks(url('components/WelcomeAiSetup.tsx'), {
    react: runner.react,
    '../../ai/components/AiMcpTab': {
      AiMcpTab: (props) => {
        capturedProviderProps = props;
        return null;
      },
    },
    '../../ai/components/ExternalAgentsTab': {
      ExternalAgentsTab: (props) => {
        capturedAcpProps = props;
        return null;
      },
    },
  });
  const setup = {
    connections: [],
    busy: false,
    error: null,
    hasChanges: false,
    save: async () => { saves++; },
    discard() {},
    checkSavedKeys: async () => {},
    draft: {
      aiConfig: structuredClone(DEFAULT_AI_CONFIG),
      externalAgents: [],
      updateAiConfig() {},
      removeApiKey() {},
      updateExternalAgents() {},
    },
  };
  let nodes = componentNodes(await runner.render(WelcomeAiSetup, { setup }));
  assert.equal(
    nodes.some((node) => node.type === 'button' && node.props.children.flat().includes('Save AI setup')),
    false,
    'Manual Save AI setup button must be removed'
  );
  capturedProviderProps.onUpdateAiConfig({ configuredProviders: ['openai'] });
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(saves, 1, 'Adding a provider auto-saves immediately');

  const acpBtn = nodes.find((node) => node.type === 'button' && node.props.children.flat().includes('ACP Agent'));
  acpBtn.props.onClick();
  nodes = componentNodes(await runner.render(WelcomeAiSetup, { setup }));
  capturedAcpProps.draftSettings.updateExternalAgents([agent]);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(saves, 2, 'Installing an ACP agent auto-saves immediately');
});

test('Skip, Close, Escape and jumping to the final slide cannot bypass required AI and reviewer setup', async (t) => {
  const runner = componentHarness(), stored = new Map(), handlers = new Map();
  const previousWindow = globalThis.window, previousStorage = globalThis.localStorage;
  globalThis.window = { location: { search: '' }, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: (name) => handlers.delete(name) };
  globalThis.localStorage = { setItem: (key, value) => stored.set(key, value) };
  t.after(() => { runner.cleanup(); globalThis.window = previousWindow; globalThis.localStorage = previousStorage; });
  let hasConnection = false, ready = false, completed = 0, saves = 0, repoActions = 0, closed = 0;
  const { FirstLaunchWelcome } = loadWithMocks(url('components/FirstLaunchWelcome.tsx'), {
    react: runner.react,
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ application: {
      windowClose: async () => closed++, windowIsMaximized: async () => false, windowIsFullscreen: async () => false,
    } }) },
    '../../../core/store/useWindowChromeStore': { useWindowChromeStore: (select) => select({ profile: {
      platform: 'windows', nativeFrame: false, controlsLeft: [], controlsRight: [],
    } }) },
    '../../../core/hooks/useCommandShortcut': { useCommandShortcut: () => ({ title: (_, fallback) => fallback }) },
    '@tauri-apps/api/core': { invoke: async () => {} },
    '../../../common/utils/shortcuts': { isMacOS: () => false },
    '../../../common/components/icons/ArrowRight': { ArrowRight: () => null },
    '../../../common/components/icons/Check': { Check: () => null },
    '../../../common/components/icons/X': { X: () => null },
    '../../../common/components/AppLogo': { AppLogo: () => null },
    '../../git/store/useGitStore': { useGitStore: { getState: () => ({ openRepoDialog: () => repoActions++, setIsCloneModalOpen: () => repoActions++ }) } },
    './WelcomeSettingsPanel': { WelcomeSettingsPanel: () => null },
    './WelcomeAiSetup': { WelcomeAiSetup: () => null },
    './OnboardingReviewerSetup': { OnboardingReviewerSetup: () => null },
    './OnboardingHello': { OnboardingHello: ({ onContinue }) => runner.react.createElement('button', { onClick: onContinue }, 'Continue') },
    '../hooks/useOnboardingPreferences': { useOnboardingPreferences: () => ({ settings: {}, setSettings() {}, isSaving: false, saveError: null, reload() {}, save: async () => { saves++; return true; } }) },
    '../hooks/useOnboardingAiSetup': {
      useOnboardingAiSetup: () => ({
        connections: hasConnection ? ['Saved ACP'] : [],
        busy: false,
        hasChanges: false,
        hasSavedRequiredReviewer: ready,
        draft: {},
        save: async () => {},
        canFinish: () => hasConnection && ready,
      }),
    },
  });
  const render = async () => componentNodes(await runner.render(FirstLaunchWelcome, { onComplete: () => completed++ }));
  const button = (nodes, name) => nodes.find((node) => node.type === 'button' && node.props.children.flat().some((child) => typeof child === 'string' && child.trim() === name));
  const { WELCOME_SLIDES } = loadWithMocks(url('constants/welcomeSlides.ts'), {});

  // Hello is first and cannot be dismissed to skip language selection.
  let nodes = await render();
  assert.ok(button(nodes, 'Continue'));
  assert.equal(button(nodes, 'Next'), undefined);
  handlers.get('keydown')({ key: 'Escape', preventDefault() {} });
  nodes = await render();
  assert.ok(button(nodes, 'Continue'));
  assert.equal(completed, 0);
  await button(nodes, 'Continue').props.onClick();
  nodes = await render();

  // Welcome & Workspace
  assert.equal(button(nodes, 'Skip tour'), undefined, 'Skipping stays unavailable until AI & reviewer are configured');
  const nextFromWelcome = button(nodes, 'Next');
  assert.ok(nextFromWelcome && !nextFromWelcome.props.disabled);
  await nextFromWelcome.props.onClick();
  nodes = await render();

  // Step 2: AI Connection (Mandatory)
  assert.ok(nodes.some((node) => node.type === 'h1' && node.props.children.includes('Set up your AI connection')));
  assert.equal(button(nodes, 'Next').props.disabled, true);
  await button(nodes, 'Next').props.onClick();
  await nodes.find((node) => node.props['data-window-control'] === 'close').props.onClick();
  assert.equal(closed, 1, 'Closing the window must remain available without completing onboarding');
  handlers.get('keydown')({ key: 'Escape', preventDefault() {} });
  await nodes.find((node) => node.props['aria-label']?.startsWith(`Go to slide ${WELCOME_SLIDES.length}:`)).props.onClick();
  nodes = await render();
  assert.equal(button(nodes, 'Open a repository'), undefined, 'The final-step button must route back to required AI setup');
  assert.equal(stored.size, 0); assert.equal(saves, 0); assert.equal(completed, 0); assert.equal(repoActions, 0);

  // Unlock AI Connection -> Advance to Step 3: Reviewer Bot (Mandatory)
  hasConnection = true;
  nodes = await render();
  assert.equal(button(nodes, 'Next').props.disabled, false);
  await button(nodes, 'Next').props.onClick();
  nodes = await render();
  assert.ok(nodes.some((node) => node.type === 'h1' && node.props.children.includes('Create your first reviewer bot')));
  assert.equal(button(nodes, 'Next').props.disabled, true, 'Reviewer step remains blocked until reviewer is saved');

  // Unlock Reviewer Bot -> Advance to Step 4: Ready
  for (const action of ['Open a repository', 'Clone a repository']) {
    hasConnection = true;
    ready = true;
    nodes = await render();
    while (!nodes.some((node) => node.type === 'h1' && node.props.children.includes('Start with a repository'))) {
      assert.equal(button(nodes, 'Next').props.disabled, false);
      await button(nodes, 'Next').props.onClick();
      nodes = await render();
    }
    assert.ok(button(nodes, 'Open a repository') && button(nodes, 'Clone a repository'));

    // Revoking AI connection routes back to Step 2 when attempting to finish
    hasConnection = false;
    ready = false;
    nodes = await render();
    await button(nodes, action).props.onClick();
    nodes = await render();
    assert.ok(nodes.some((node) => node.type === 'h1' && node.props.children.includes('Set up your AI connection')));
    assert.equal(stored.size, 0); assert.equal(saves, 0); assert.equal(completed, 0); assert.equal(repoActions, 0);
  }

  hasConnection = true;
  ready = true;
  nodes = await render();
  await button(nodes, 'Next').props.onClick();
  nodes = await render();
  await button(nodes, 'Next').props.onClick();
  nodes = await render();
  await button(nodes, 'Skip tour').props.onClick();
  assert.equal(completed, 1);
  assert.equal(saves, 1);
  assert.equal(stored.get('stage0_first_launch_welcome_v1'), 'completed');
});
