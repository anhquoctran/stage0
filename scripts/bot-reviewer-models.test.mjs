import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const url = (path) => new URL(`../frontend/features/ai/${path}`, import.meta.url);
const presets = loadWithMocks(url('constants/aiPresets.ts'), {});
const bots = loadWithMocks(url('constants/botPresets.ts'), {});
const catalogUtils = loadWithMocks(url('utils/providerModelCatalog.ts'), {
  '../constants/aiPresets': presets,
});
const modelPresets = loadWithMocks(url('utils/resolveAiModelPreset.ts'), {
  '../constants/aiPresets': presets,
});
const sample = (overrides = {}) => ({
  id: 'fixture-bot', name: 'Fixture reviewer', tagline: '', description: '',
  category: 'custom', avatarEmoji: '🤖', systemPrompt: 'Review safely.',
  provider: 'openai', model: 'saved-private-model', enabled: true, isBuiltin: false,
  ...overrides,
});
const text = (node) => componentNodes(node)
  .flatMap((item) => [item.props?.children].flat(Infinity))
  .filter((value) => typeof value === 'string').join(' ');
const button = (nodes, label) => nodes.find((node) => node.type === 'button' && text(node).trim() === label);
const labelled = (nodes, label) => nodes.find((node) => node.props?.['aria-label'] === label);
const providerUrl = (id) => presets.AI_PROVIDERS.find((provider) => provider.id === id).defaultBaseUrl;

test('Anthropic model capabilities use API metadata and saved choices survive an empty catalog', () => {
  const model = { id: 'claude-opus-5-5', name: 'Claude', reasoningEfforts: ['low', 'high'], supportsFastMode: true };
  const baseUrl = providerUrl('anthropic');
  assert.deepEqual(modelPresets.resolveAiModelPreset('anthropic', model.id, baseUrl, [model]).reasoningEfforts, ['low', 'high']);
  assert.equal(modelPresets.resolveAiModelPreset('anthropic', model.id, 'https://example.com/v1', [model]).supportsFastMode, undefined);
  const { resolveReviewBotConfig } = loadWithMocks(new URL('../frontend/features/review/utils/resolveReviewBotConfig.ts', import.meta.url), {});
  const cfg = { ...presets.DEFAULT_AI_CONFIG, provider: 'anthropic', baseUrl, model: model.id };
  const result = resolveReviewBotConfig(cfg, sample({ provider: 'anthropic', model: model.id, reasoningEffort: 'high', fastMode: true }));
  assert.equal(result.reasoningEffort, 'high');
  assert.equal(result.fastMode, true);
});

function fixture(initial = [], initialModels = {}, {
  externalAgents = [], discover = () => assert.fail('Provider forms must not launch ACP discovery'),
  discoveredByProvider = {},
} = {}) {
  const harness = componentHarness();
  const writes = [];
  const fetches = [];
  const draft = {
    aiConfig: {
      ...presets.DEFAULT_AI_CONFIG,
      provider: 'openai',
      configuredProviders: ['openai', 'anthropic'],
      model: 'draft-global-model',
    },
    globalReviewers: structuredClone(initial),
    externalAgents,
    addGlobalReviewer: (bot) => { writes.push(['add', bot]); draft.globalReviewers.push({ ...bot, id: 'new-bot' }); },
    updateGlobalReviewer: (id, partial) => {
      writes.push(['update', id, partial]);
      draft.globalReviewers = draft.globalReviewers.map((bot) => bot.id === id ? { ...bot, ...partial } : bot);
    },
  };
  let modelCatalogs = { ...initialModels };
  const fetchDynamicModels = async (config) => {
    fetches.push(config);
    const models = discoveredByProvider[config.provider] || [];
    modelCatalogs = {
      ...modelCatalogs,
      [catalogUtils.providerModelCatalogKey(config.provider, config.baseUrl || '')]: models,
    };
    return { success: true, count: models.length, models };
  };
  const select = (props) => harness.react.createElement('button', {
    'aria-label': props['aria-label'], onChange: props.onChange,
    options: props.options, value: props.value,
  }, props.value);
  const dependencies = {
    '../../../core/services/runtime/useApplicationServices': {
      useApplicationServices: () => ({ externalAgents: { acpAgentReviewConfigOptions: discover } }),
    },
    react: harness.react,
    '../constants/aiPresets': presets,
    '../constants/botPresets': bots,
    '../utils/resolveAiModelPreset': modelPresets,
    '../utils/botRolePrompts': { getBotRolePrompt: () => 'Fixture prompt' },
    './AiModelExecutionOptions': { AiModelExecutionOptions: () => null },
    '../store/useAiMcpStore': {
      useAiMcpStore: () => ({
        aiConfig: { ...presets.DEFAULT_AI_CONFIG, provider: 'openai', model: 'committed-model' },
        dynamicModels: modelCatalogs,
        fetchDynamicModels,
        isFetchingDynamicModels: false,
        dynamicModelError: null,
      }),
    },
    '../store/useBotReviewersStore': {
      useBotReviewersStore: () => ({
        globalReviewers: [],
        addGlobalReviewer: () => assert.fail('Editing must not mutate committed reviewers'),
        updateGlobalReviewer: () => assert.fail('Editing must remain a draft'),
      }),
    },
    '../../../common/components/CustomSelect': { CustomSelect: select },
  };
  const source = readFileSync(url('components/BotReviewersTab.tsx'), 'utf8');
  for (const [, name, path] of source.matchAll(/import \{ (\w+) \} from '([^']+\/icons\/[^']+)';/g)) {
    dependencies[path] = { [name]: () => null };
  }
  const { BotReviewersTab } = loadWithMocks(url('components/BotReviewersTab.tsx'), dependencies);
  const render = async () => componentNodes(await harness.render(BotReviewersTab, { draftSettings: draft }));
  const open = async () => { const nodes = await render(); button(nodes, 'New Reviewer').props.onClick(); return render(); };
  return { harness, draft, writes, fetches, render, open, select };
}

test('new reviewer requires explicit provider and API model selections', async () => {
  const f = fixture();
  try {
    const nodes = await f.open();
    const models = labelled(nodes, 'Model override');
    assert.equal(models.type, f.select);
    assert.equal(labelled(nodes, 'Provider override').props.value, '');
    assert.deepEqual(labelled(nodes, 'Provider override').props.options.map((option) => option.value), ['openai', 'anthropic']);
    assert.equal(models.props.value, '');
    assert.deepEqual(models.props.options, []);
    assert.equal(labelled(nodes, 'Custom model ID'), undefined);
    assert.equal(nodes.some((node) => node.type === 'input' && /model/i.test(node.props?.id || '')), false);
    assert.equal(button(nodes, 'Create Bot').props.disabled, true);
    assert.deepEqual(f.writes, []);
  } finally { f.harness.cleanup(); }
});

test('choosing a reviewer provider loads its model catalog from that provider API', async () => {
  const f = fixture();
  try {
    let nodes = await f.open();
    labelled(nodes, 'Provider override').props.onChange('anthropic');
    await new Promise((resolve) => setImmediate(resolve));
    nodes = await f.render();
    const modelPicker = labelled(nodes, 'Model override');
    assert.equal(modelPicker.props.value, '');
    assert.deepEqual(modelPicker.props.options, []);
    assert.equal(button(nodes, 'Create Bot').props.disabled, true);
    assert.equal(nodes.some((node) => node.type === 'input' && /model/i.test(node.props?.id || '')), false);
    assert.equal(f.fetches.length, 1);
    assert.equal(f.fetches[0].provider, 'anthropic');
    assert.deepEqual(f.writes, []);
  } finally { f.harness.cleanup(); }
});

test('provider API model choices are never selected implicitly', async () => {
  const liveModels = [{ id: 'claude-api-model', name: 'API Claude model' }];
  const f = fixture([], {}, { discoveredByProvider: { anthropic: liveModels } });
  try {
    let nodes = await f.open();
    nodes.find((node) => node.type === 'input' && node.props.placeholder === 'e.g. Accessibility Auditor')
      .props.onChange({ target: { value: 'API backed reviewer' } });
    nodes = await f.render();
    labelled(nodes, 'Provider override').props.onChange('anthropic');
    await new Promise((resolve) => setImmediate(resolve));
    nodes = await f.render();
    assert.equal(f.fetches.length, 1);
    assert.equal(f.fetches[0].provider, 'anthropic');
    assert.equal(f.fetches[0].baseUrl, providerUrl('anthropic'));
    const modelPicker = labelled(nodes, 'Model override');
    assert.equal(modelPicker.props.value, '');
    assert.deepEqual(modelPicker.props.options.map((option) => option.value), ['claude-api-model']);
    assert.equal(button(nodes, 'Create Bot').props.disabled, true);
    modelPicker.props.onChange('claude-api-model');
    nodes = await f.render();
    assert.equal(labelled(nodes, 'Model override').props.value, 'claude-api-model');
    assert.equal(button(nodes, 'Create Bot').props.disabled, false);
    assert.deepEqual(f.writes, []);
  } finally { f.harness.cleanup(); }
});

test('catalogs are scoped to provider and endpoint, and unavailable saved model IDs stay disabled', async () => {
  const openAiModel = [{ id: 'openai-api-model', name: 'OpenAI API model' }];
  const f = fixture([sample()], {
    [catalogUtils.providerModelCatalogKey('openai', providerUrl('openai'))]: openAiModel,
    [catalogUtils.providerModelCatalogKey('anthropic', providerUrl('anthropic'))]: [
      { id: 'claude-only', name: 'Claude only' },
    ],
  });
  try {
    let nodes = await f.render();
    nodes.find((node) => node.props?.title === 'Edit bot settings and prompt').props.onClick();
    nodes = await f.render();
    const modelPicker = labelled(nodes, 'Model override');
    assert.equal(modelPicker.props.options.find((option) => option.value === 'saved-private-model').disabled, true);
    assert.ok(modelPicker.props.options.some((option) => option.value === 'openai-api-model'));
    assert.ok(!modelPicker.props.options.some((option) => option.value === 'claude-only'));
    assert.equal(labelled(nodes, 'Custom model ID'), undefined);
    assert.deepEqual(f.writes, []);
  } finally { f.harness.cleanup(); }
});

test('Create Bot stays disabled through ACP loading, failure, retry and model changes, and Enter cannot bypass it', async () => {
  const requests = [];
  const f = fixture([], {}, {
    externalAgents: [{ id: 'one', name: 'Fixture ACP', command: 'fixture-acp', args: [], source: 'custom' }],
    discover: (args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })),
  });
  const model = { id: 'model', name: 'Model', type: 'select', reviewKind: 'model', currentValue: 'first', options: [{ value: 'first', name: 'First' }, { value: 'second', name: 'Second' }] };
  try {
    let nodes = await f.open();
    nodes.find((node) => node.type === 'input' && node.props.placeholder === 'e.g. Accessibility Auditor').props.onChange({ target: { value: 'ACP Reviewer' } });
    nodes = await f.render();
    assert.equal(button(nodes, 'Create Bot').props.disabled, true);
    labelled(nodes, 'Execution engine').props.onChange('acp');
    nodes = await f.render();
    assert.equal(button(nodes, 'Create Bot').props.disabled, true);
    nodes.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.deepEqual(f.writes, []);
    requests[0].reject(new Error('Fixture discovery failure'));
    nodes = await f.render();
    assert.equal(button(nodes, 'Create Bot').props.disabled, true);
    assert.match(text({ props: { children: nodes } }), /Retry to finish configuring this bot/);
    button(nodes, 'Retry').props.onClick();
    nodes = await f.render();
    assert.equal(button(nodes, 'Create Bot').props.disabled, true);
    requests[1].resolve([model]);
    nodes = await f.render();
    assert.equal(button(nodes, 'Create Bot').props.disabled, false);
    labelled(nodes, 'Model for Fixture ACP').props.onChange('second');
    nodes.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.deepEqual(f.writes, []);
    nodes = await f.render();
    assert.equal(button(nodes, 'Create Bot').props.disabled, true);
    requests[2].resolve([model]);
    nodes = await f.render();
    assert.equal(button(nodes, 'Create Bot').props.disabled, false);
    nodes.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(f.writes.length, 1);
    assert.deepEqual(f.writes[0][1].acpConfigOptions, { model: 'second' });
  } finally { f.harness.cleanup(); }
});
