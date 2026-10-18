import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const url = (path) => new URL(`../frontend/features/ai/${path}`, import.meta.url);
const presets = loadWithMocks(url('constants/aiPresets.ts'), {});
const bots = loadWithMocks(url('constants/botPresets.ts'), {});
const sample = (overrides = {}) => ({ id: 'fixture-bot', name: 'Fixture reviewer', tagline: '', description: '', category: 'custom', avatarEmoji: '🤖', systemPrompt: 'Review safely.', provider: 'openai', model: 'saved-private-model', enabled: true, isBuiltin: false, ...overrides });
const text = (node) => componentNodes(node).flatMap((item) => [item.props?.children].flat(Infinity)).filter((value) => typeof value === 'string').join(' ');
const button = (nodes, label) => nodes.find((node) => node.type === 'button' && text(node).trim() === label);
const labelled = (nodes, label) => nodes.find((node) => node.props?.['aria-label'] === label);

function fixture(initial = [], dynamicModels = {}) {
  const harness = componentHarness(); const writes = [];
  const draft = {
    aiConfig: { ...presets.DEFAULT_AI_CONFIG, provider: 'openai', model: 'draft-global-model' },
    globalReviewers: structuredClone(initial),
    addGlobalReviewer: (bot) => { writes.push(['add', bot]); draft.globalReviewers.push({ ...bot, id: 'new-bot' }); },
    updateGlobalReviewer: (id, partial) => { writes.push(['update', id, partial]); draft.globalReviewers = draft.globalReviewers.map((bot) => bot.id === id ? { ...bot, ...partial } : bot); },
  };
  const select = () => null;
  const dependencies = {
    react: harness.react, '../constants/aiPresets': presets, '../constants/botPresets': bots,
    '../store/useAiMcpStore': { useAiMcpStore: () => ({ aiConfig: { ...presets.DEFAULT_AI_CONFIG, provider: 'anthropic', model: 'committed-model' }, dynamicModels }) },
    '../store/useBotReviewersStore': { useBotReviewersStore: () => ({ globalReviewers: [], addGlobalReviewer: () => assert.fail('Editing must not mutate committed reviewers'), updateGlobalReviewer: () => assert.fail('Editing must remain a draft') }) },
    '../../../common/components/CustomSelect': { CustomSelect: select },
  };
  const source = readFileSync(url('components/BotReviewersTab.tsx'), 'utf8');
  for (const [, name, path] of source.matchAll(/import \{ (\w+) \} from '([^']+\/icons\/[^']+)';/g)) dependencies[path] = { [name]: () => null };
  const { BotReviewersTab } = loadWithMocks(url('components/BotReviewersTab.tsx'), dependencies);
  const render = async () => componentNodes(await harness.render(BotReviewersTab, { draftSettings: draft }));
  const open = async () => { const nodes = await render(); button(nodes, 'New Reviewer').props.onClick(); return render(); };
  return { harness, draft, writes, render, open, select };
}

test('new reviewer inherits the draft global model and offers a searchable dropdown, not a required model ID input', async () => {
  const f = fixture();
  try {
    const nodes = await f.open(); const models = labelled(nodes, 'Model override');
    assert.equal(models.type, f.select); assert.equal(models.props.searchable, true);
    assert.equal(models.props.value, 'global_default');
    assert.match(models.props.options[0].label, /draft-global-model/);
    assert.ok(models.props.options.some((option) => option.value === 'draft-global-model'));
    assert.ok(models.props.options.some((option) => option.value === presets.AI_PROVIDERS[0].defaultModel));
    assert.equal(labelled(nodes, 'Custom model ID'), undefined);
    assert.deepEqual(f.writes, []);
  } finally { f.harness.cleanup(); }
});

test('changing providers selects its default model and replaces the list without retaining another provider models', async () => {
  const f = fixture();
  try {
    let nodes = await f.open(); labelled(nodes, 'Provider override').props.onChange('anthropic'); nodes = await f.render();
    let models = labelled(nodes, 'Model override'); const preset = presets.AI_PROVIDERS.find((provider) => provider.id === 'anthropic');
    assert.equal(models.props.value, preset.defaultModel);
    assert.ok(preset.models.every((model) => models.props.options.some((option) => option.value === model.id)));
    assert.ok(!models.props.options.some((option) => option.value === presets.AI_PROVIDERS[0].defaultModel));
    labelled(nodes, 'Provider override').props.onChange('global_default'); nodes = await f.render();
    models = labelled(nodes, 'Model override'); assert.equal(models.props.value, 'global_default');
    assert.match(models.props.options[0].label, /draft-global-model/);
    assert.deepEqual(f.writes, []);
  } finally { f.harness.cleanup(); }
});

test('cached model discovery is combined with presets and deduplicated without fetching or reading credentials', async () => {
  const first = presets.AI_PROVIDERS[0].models[0];
  const f = fixture([], { openai: [{ id: first.id, name: 'Cached friendly name' }, { id: 'discovered-model', name: 'Discovered' }], anthropic: [{ id: 'other-provider-model', name: 'Other' }] });
  try {
    const nodes = await f.open(); const options = labelled(nodes, 'Model override').props.options;
    assert.equal(options.filter((option) => option.value === first.id).length, 1);
    assert.equal(options.find((option) => option.value === first.id).label, 'Cached friendly name');
    assert.ok(options.some((option) => option.value === 'discovered-model'));
    assert.ok(!options.some((option) => option.value === 'other-provider-model'));
    assert.deepEqual(f.writes, []);
  } finally { f.harness.cleanup(); }
});

test('editing a saved custom model preserves it as a dropdown option and updates only the draft', async () => {
  const f = fixture([sample()]);
  try {
    let nodes = await f.render(); nodes.find((node) => node.props?.title === 'Edit bot settings and prompt').props.onClick(); nodes = await f.render();
    const models = labelled(nodes, 'Model override');
    assert.equal(models.props.value, 'saved-private-model');
    assert.ok(models.props.options.some((option) => option.value === 'saved-private-model'));
    assert.equal(labelled(nodes, 'Custom model ID'), undefined);
    nodes.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(f.writes[0][0], 'update'); assert.equal(f.writes[0][2].model, 'saved-private-model');
  } finally { f.harness.cleanup(); }
});

test('custom model entry is optional, validated, trimmed and cancelled without mutating the draft', async () => {
  const f = fixture([sample({ model: presets.DEFAULT_AI_CONFIG.model })]);
  try {
    let nodes = await f.render(); nodes.find((node) => node.props?.title === 'Edit bot settings and prompt').props.onClick(); nodes = await f.render();
    const custom = labelled(nodes, 'Model override').props.options.find((option) => option.label === 'Custom model…');
    labelled(nodes, 'Model override').props.onChange(custom.value); nodes = await f.render();
    assert.equal(labelled(nodes, 'Custom model ID').props.value, '');
    nodes.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }); nodes = await f.render();
    assert.match(text({ props: { children: nodes } }), /Select a model or enter a custom model ID/); assert.deepEqual(f.writes, []);
    labelled(nodes, 'Custom model ID').props.onChange({ target: { value: '  my-custom-model  ' } }); nodes = await f.render();
    nodes.find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} });
    assert.equal(f.writes[0][2].model, 'my-custom-model');
    nodes = await f.open(); const before = structuredClone(f.draft.globalReviewers);
    labelled(nodes, 'Model override').props.onChange(custom.value); nodes = await f.render();
    labelled(nodes, 'Custom model ID').props.onChange({ target: { value: 'discard-this' } }); nodes = await f.render();
    button(nodes, 'Cancel').props.onClick(); await f.render();
    assert.deepEqual(f.draft.globalReviewers, before); assert.equal(f.writes.length, 1);
  } finally { f.harness.cleanup(); }
});

test('selecting a preset leaves custom-entry mode and provider changes never carry a previous custom ID', async () => {
  const f = fixture();
  try {
    let nodes = await f.open(); const custom = labelled(nodes, 'Model override').props.options.find((option) => option.label === 'Custom model…');
    labelled(nodes, 'Model override').props.onChange(custom.value); nodes = await f.render();
    labelled(nodes, 'Custom model ID').props.onChange({ target: { value: 'old-custom-model' } }); nodes = await f.render();
    labelled(nodes, 'Model override').props.onChange(presets.DEFAULT_AI_CONFIG.model); nodes = await f.render();
    assert.equal(labelled(nodes, 'Custom model ID'), undefined);
    labelled(nodes, 'Provider override').props.onChange('ollama'); nodes = await f.render();
    const local = presets.AI_PROVIDERS.find((provider) => provider.id === 'ollama');
    assert.equal(labelled(nodes, 'Model override').props.value, local.defaultModel);
    assert.ok(!labelled(nodes, 'Model override').props.options.some((option) => option.value === 'old-custom-model'));
  } finally { f.harness.cleanup(); }
});
