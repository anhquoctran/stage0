import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const source = new URL('../frontend/features/onboarding/components/OnboardingReviewerSetup.tsx', import.meta.url);
const agent = { id: 'claude-acp', name: 'Claude Agent', command: 'claude-agent-acp', args: [], source: 'registry' };
const secondAgent = { id: 'cursor', name: 'Cursor', command: 'cursor-agent', args: [], source: 'registry' };

function fixture({ providerIds = [], provider = 'openai', externalAgents = [], reviewers = [] } = {}) {
  const harness = componentHarness();
  const added = [];
  let autoSaves = 0;
  const { OnboardingReviewerSetup } = loadWithMocks(source, {
    react: harness.react,
    '../../../common/components/CustomSelect': {
      CustomSelect: ({ value, 'aria-label': ariaLabel }) =>
        harness.react.createElement('button', { 'aria-label': ariaLabel }, value),
    },
    '../../ai/store/useAiMcpStore': {
      useAiMcpStore: (selector) => selector({ dynamicModels: {} }),
    },
    '../../ai/components/AcpReviewerConfigOptions': { AcpReviewerConfigOptions: () => null },
    '../../ai/components/AiModelExecutionOptions': { AiModelExecutionOptions: () => null },
    '../../ai/hooks/useAcpReviewerConfigOptions': {
      useAcpReviewerConfigOptions: () => ({
        options: [],
        loading: false,
        error: null,
        validationError: null,
        retry() {},
        reset() {},
        updateOption() {},
        ready: true,
        isReady: () => true,
      }),
    },
    '../../ai/constants/aiPresets': {
      AI_PROVIDERS: [{
        id: 'openai',
        name: 'OpenAI',
        defaultModel: 'gpt-test',
        models: [{ id: 'gpt-test', name: 'Test model' }],
      }],
    },
    '../../ai/utils/aiProviderSettings': {
      providerSettingsFor: () => ({ model: 'gpt-test', baseUrl: 'https://api.openai.com/v1' }),
    },
    '../../ai/utils/resolveAiModelPreset': {
      resolveAiModelPreset: (_provider, model) => model === 'gpt-test' ? { id: model, name: 'Test model' } : undefined,
    },
  });
  const draftSettings = {
    aiConfig: { configuredProviders: providerIds, provider },
    externalAgents,
    globalReviewers: reviewers,
    addGlobalReviewer: (reviewer) => added.push(reviewer),
  };
  const render = () =>
    harness.render(OnboardingReviewerSetup, {
      draftSettings,
      hasSavedRequiredReviewer: false,
      onAutoSave: () => {
        autoSaves++;
      },
    });
  return { harness, added, getAutoSaves: () => autoSaves, render };
}

test('quick setup creates an enabled general reviewer with the configured provider defaults and auto-saves', async (t) => {
  const setup = fixture({ providerIds: ['openai'] });
  t.after(() => setup.harness.cleanup());
  let nodes = componentNodes(await setup.render());
  assert.equal(nodes.some((node) => node.type === 'select'), false, 'A single connection needs no selector');
  assert.equal(nodes.some((node) => node.type === 'textarea'), false, 'Advanced prompts stay out of onboarding');
  nodes.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.deepEqual(setup.added[0], {
    name: 'Code Reviewer',
    tagline: 'Code review',
    description: 'Checks code changes for correctness, reliability, and maintainability.',
    category: 'custom',
    avatarEmoji: '🤖',
    customInstructions: '',
    provider: 'openai',
    model: 'gpt-test',
    temperature: 0.2,
    enabled: true,
    isBuiltin: false,
  });
  assert.equal(setup.getAutoSaves(), 1);
});

test('ACP quick setup requires explicit consent before creating the reviewer', async (t) => {
  const setup = fixture({ externalAgents: [agent, secondAgent] });
  t.after(() => setup.harness.cleanup());
  let nodes = componentNodes(await setup.render());
  const create = () => nodes.find((node) => node.type === 'button' && node.props.children.flat(Infinity).includes('Create first reviewer'));
  assert.equal(create().props.disabled, true);
  nodes.find((node) => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  nodes = componentNodes(await setup.render());
  assert.equal(create().props.disabled, false);
  nodes.find((node) => node.type === 'select').props.onChange({ target: { value: 'acp:cursor' } });
  nodes = componentNodes(await setup.render());
  assert.equal(create().props.disabled, true, 'Consent applies only to the selected ACP agent');
  nodes.find((node) => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  nodes = componentNodes(await setup.render());
  nodes.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(setup.added[0].acpAgentId, 'cursor');
  assert.equal(setup.added[0].allowAcpSourceTransfer, true);
  assert.equal(setup.added[0].enabled, true);
});

test('a saved enabled custom reviewer replaces the creation form with a short completion state', async (t) => {
  const setup = fixture({
    providerIds: ['openai'],
    reviewers: [{ id: 'custom-1', name: 'Review bot', enabled: true, isBuiltin: false }],
  });
  t.after(() => setup.harness.cleanup());
  const nodes = componentNodes(await setup.render());
  assert.equal(nodes.some((node) => node.type === 'form'), false);
  assert.ok(nodes.some((node) => node.props?.role === 'status'));
});
