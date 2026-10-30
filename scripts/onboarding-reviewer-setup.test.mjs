import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const source = new URL('../frontend/features/onboarding/components/OnboardingReviewerSetup.tsx', import.meta.url);
const catalogUtils = loadWithMocks(new URL('../frontend/features/ai/utils/providerModelCatalog.ts', import.meta.url), {
  '../constants/aiPresets': { AI_PROVIDERS: [{ id: 'openai', models: [] }] },
});
const agent = { id: 'claude-acp', name: 'Claude Agent', command: 'claude-agent-acp', args: [], source: 'registry' };
const secondAgent = { id: 'cursor', name: 'Cursor', command: 'cursor-agent', args: [], source: 'registry' };
const labelled = (nodes, label) => nodes.find((node) => node.props?.['aria-label'] === label);

function fixture({ providerIds = [], provider = 'openai', externalAgents = [], reviewers = [] } = {}) {
  const harness = componentHarness();
  const added = [];
  const fetches = [];
  let dynamicModels = {};
  let autoSaves = 0;
  const { OnboardingReviewerSetup } = loadWithMocks(source, {
    react: harness.react,
    '../../../common/components/CustomSelect': {
      CustomSelect: (props) => harness.react.createElement('button', {
        'aria-label': props['aria-label'], onChange: props.onChange,
        options: props.options, value: props.value,
      }, props.value),
    },
    '../../ai/store/useAiMcpStore': {
      useAiMcpStore: () => ({
        dynamicModels,
        isFetchingDynamicModels: false,
        dynamicModelError: null,
        fetchDynamicModels: async (config) => {
          fetches.push(config);
          const models = [{ id: 'gpt-test', name: 'API Test model' }];
          dynamicModels = {
            ...dynamicModels,
            [catalogUtils.providerModelCatalogKey(config.provider, config.baseUrl)]: models,
          };
          return { success: true, count: models.length, models };
        },
      }),
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
  return { harness, added, fetches, getAutoSaves: () => autoSaves, render };
}

test('quick setup requires an API-discovered model and creates an enabled reviewer with that ID', async (t) => {
  const setup = fixture({ providerIds: ['openai'] });
  t.after(() => setup.harness.cleanup());
  let nodes = componentNodes(await setup.render());
  assert.equal(labelled(nodes, 'AI connection').props.options.length, 1, 'the reviewer connection is selected explicitly');
  assert.equal(nodes.some((node) => node.type === 'textarea'), false, 'Advanced prompts stay out of onboarding');
  const create = () => nodes.find((node) => node.type === 'button' && node.props.children.flat(Infinity).includes('Create first reviewer'));
  assert.equal(create().props.disabled, true, 'no static default is accepted before model discovery');
  const connection = labelled(nodes, 'AI connection');
  assert.equal(connection.props.value, '');
  connection.props.onChange('provider:openai');
  await new Promise((resolve) => setImmediate(resolve));
  nodes = componentNodes(await setup.render());
  assert.equal(setup.fetches.length, 1);
  assert.equal(setup.fetches[0].provider, 'openai');
  assert.equal(labelled(nodes, 'Reviewer model').props.options.map((option) => option.value).join(','), 'gpt-test');
  assert.equal(labelled(nodes, 'Reviewer model').props.value, '', 'loading a catalog does not silently select its first model');
  assert.equal(create().props.disabled, true);
  labelled(nodes, 'Reviewer model').props.onChange('gpt-test');
  nodes = componentNodes(await setup.render());
  assert.equal(create().props.disabled, false);
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
  labelled(nodes, 'AI connection').props.onChange('acp:claude-acp');
  nodes = componentNodes(await setup.render());
  nodes.find((node) => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  nodes = componentNodes(await setup.render());
  assert.equal(create().props.disabled, false);
  labelled(nodes, 'AI connection').props.onChange('acp:cursor');
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
