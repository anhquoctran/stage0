import assert from 'node:assert/strict';
import test from 'node:test';
import { hookHarness } from './helpers/hookHarness.mjs';
import { loadWithMocks } from './helpers/componentHarness.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const agent = (id) => ({ id, name: id, command: `fixture-${id}`, args: [], source: 'custom' });
const model = { id: 'model', name: 'Model', reviewKind: 'model', type: 'select', currentValue: 'first', options: [{ value: 'first', name: 'First' }, { value: 'second', name: 'Second' }] };
const effort = { id: 'effort', name: 'Effort', reviewKind: 'reasoning', type: 'select', currentValue: 'low', options: [{ value: 'low', name: 'Low' }, { value: 'high', name: 'High' }] };
const fast = { id: 'fast', name: 'Fast', reviewKind: 'fastMode', type: 'boolean', currentValue: false };
const submit = (form) => form.handleSaveForm({ preventDefault() {} });

function fixture(t) {
  const runner = hookHarness();
  t.after(() => runner.cleanup());
  const requests = [], writes = [];
  const props = {
    globalAiConfig: { provider: 'openai', model: 'fixture-model', baseUrl: 'https://example.test' },
    dynamicModels: {}, externalAgents: [agent('one'), agent('two')],
    addGlobalReviewer: (value) => writes.push(['add', value]),
    updateGlobalReviewer: (...args) => writes.push(['update', ...args]),
  };
  const { useReviewerBotForm } = loadWithMocks(new URL('../frontend/features/ai/components/useReviewerBotForm.ts', import.meta.url), {
    react: runner.react,
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ externalAgents: {
      acpAgentReviewConfigOptions: (args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })),
    } }) },
  });
  const render = () => runner.render(useReviewerBotForm, props);
  let form = render();
  form.handleOpenAdd();
  form = render();
  form.setFormName('Ready reviewer');
  form.setFormExecutionMode('acp');
  form = render();
  return { render, form, props, requests, writes };
}

test('ACP discovery gates submit until success; agent defaults and empty advertised options are valid', async (t) => {
  const f = fixture(t);
  assert.equal(f.requests.length, 1);
  assert.equal(f.form.canSubmit, false);
  submit(f.form);
  assert.deepEqual(f.writes, []);
  f.requests[0].resolve([]);
  await tick();
  const form = f.render();
  assert.equal(form.canSubmit, true);
  submit(form);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0][1].acpAgentId, 'one');
  assert.equal(f.writes[0][1].acpConfigOptions, undefined);
  assert.equal(f.writes[0][1].allowAcpSourceTransfer, false);
});

test('changing ACP models immediately blocks submit and clears dependent overrides until reload succeeds', async (t) => {
  const f = fixture(t);
  f.requests[0].resolve([model, effort, fast]);
  await tick();
  let form = f.render();
  form.acpConfig.updateOption(effort, 'high');
  form = f.render();
  form.acpConfig.updateOption(fast, true);
  form = f.render();
  assert.equal(form.canSubmit, true);
  form.acpConfig.updateOption(model, 'second');
  // Use the same callback before a rerender, as an immediate form submit could.
  submit(form);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.requests[1].args.configOverrides, { model: 'second' });
  form = f.render();
  assert.equal(form.canSubmit, false);
  assert.deepEqual(form.formAcpConfigOptions, { model: 'second' });
  f.requests[1].resolve([model, effort]);
  await tick();
  form = f.render();
  assert.equal(form.canSubmit, true);
  submit(form);
  assert.deepEqual(f.writes[0][1].acpConfigOptions, { model: 'second' });
});

test('discovery failure blocks saving and retry stays blocked until its own successful response', async (t) => {
  const f = fixture(t);
  f.requests[0].reject(new Error('fixture failure'));
  await tick();
  let form = f.render();
  assert.equal(form.acpConfig.error, 'fixture failure');
  assert.equal(form.canSubmit, false);
  submit(form);
  assert.deepEqual(f.writes, []);
  form.acpConfig.retry();
  submit(form);
  form = f.render();
  assert.equal(form.canSubmit, false);
  f.requests[1].resolve([model]);
  await tick();
  form = f.render();
  assert.equal(form.canSubmit, true);
  assert.equal(form.acpConfig.error, null);
});

test('late responses cannot unlock a different agent, a model reload, or a reopened form', async (t) => {
  const f = fixture(t);
  f.form.setFormAcpAgentId('two');
  let form = f.render();
  f.requests[0].resolve([model]);
  await tick();
  form = f.render();
  assert.equal(form.canSubmit, false);
  f.requests[1].resolve([model]);
  await tick();
  form = f.render();
  assert.equal(form.canSubmit, true);
  form.acpConfig.updateOption(model, 'second');
  form = f.render();
  form.acpConfig.retry();
  form = f.render();
  f.requests[2].resolve([model]);
  await tick();
  form = f.render();
  assert.equal(form.canSubmit, false);
  form.setIsFormOpen(false);
  form = f.render();
  form.handleOpenAdd();
  form = f.render();
  form.setFormName('Reopened');
  form.setFormExecutionMode('acp');
  form = f.render();
  f.requests[3].resolve([model]);
  await tick();
  form = f.render();
  assert.equal(form.canSubmit, false);
  f.requests[4].resolve([model]);
  await tick();
  assert.equal(f.render().canSubmit, true);
});

test('editing saved model overrides waits for the model-specific discovery request', async (t) => {
  const f = fixture(t);
  f.form.handleOpenEdit({ id: 'existing', name: 'Existing', category: 'custom', avatarEmoji: '🤖', acpAgentId: 'two', acpConfigOptions: { model: 'second', effort: 'high' } });
  let form = f.render();
  f.requests[1].resolve([model, effort]);
  await tick();
  form = f.render();
  assert.equal(form.canSubmit, false);
  submit(form);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.requests[2].args.configOverrides, { model: 'second' });
  f.requests[2].resolve([model, effort]);
  await tick();
  form = f.render();
  assert.equal(form.canSubmit, true);
  submit(form);
  assert.equal(f.writes[0][0], 'update');
  assert.deepEqual(f.writes[0][2].acpConfigOptions, { model: 'second', effort: 'high' });
});

test('removed or invalid saved options block saving and can be reset to agent defaults', async (t) => {
  const f = fixture(t);
  f.requests[0].resolve([model, effort, fast]);
  await tick();
  let form = f.render();
  for (const invalid of [{ unknown: true }, { effort: 'removed' }, { fast: 'true' }, { model: false }]) {
    form.setFormAcpConfigOptions(invalid);
    form = f.render();
    assert.equal(form.canSubmit, false);
    assert.match(form.acpConfig.validationError, /no longer available/);
    submit(form);
    assert.deepEqual(f.writes, []);
  }
  form.acpConfig.reset();
  form = f.render();
  assert.equal(form.canSubmit, false);
  f.requests[1].resolve([model]);
  await tick();
  form = f.render();
  assert.equal(form.canSubmit, true);
  assert.deepEqual(form.formAcpConfigOptions, {});
});

test('missing agents and blank required fields block submit; provider mode requires an explicit provider and model without ACP discovery', async (t) => {
  const f = fixture(t);
  f.form.setFormAcpAgentId('missing');
  let form = f.render();
  assert.equal(form.canSubmit, false);
  submit(form);
  assert.deepEqual(f.writes, []);
  assert.equal(f.requests.length, 1);
  form.setFormExecutionMode('provider');
  form = f.render();
  assert.equal(form.canSubmit, false);
  form.setFormProvider('openai');
  form.setFormModel('fixture-model');
  form = f.render();
  assert.equal(form.canSubmit, true);
  form.setFormName('   ');
  form = f.render();
  assert.equal(form.canSubmit, false);
  submit(form);
  assert.deepEqual(f.writes, []);
  form.setFormName('Provider reviewer');
  form.setFormModel('  ');
  form = f.render();
  assert.equal(form.canSubmit, false);
  submit(form);
  assert.deepEqual(f.writes, []);
  assert.equal(f.requests.length, 1);
});


test('repo-exclusive bot saving uses the same ACP readiness gate and keeps its existing payload', async (t) => {
  const runner = hookHarness();
  t.after(() => runner.cleanup());
  const requests = [], writes = [];
  const props = { currentRepoId: 'repo', inheritAgents: false, externalAgents: [agent('repo-agent')], showToast() {}, addRepoCustomReviewer: (...args) => writes.push(args) };
  const { useRepositoryBotForm } = loadWithMocks(new URL('../frontend/features/git/components/repository-settings/useRepositoryBotForm.ts', import.meta.url), {
    react: runner.react,
    '@/core/services/runtime/useApplicationServices': { useApplicationServices: () => ({ externalAgents: {
      acpAgentReviewConfigOptions: (args) => new Promise((resolve, reject) => requests.push({ args, resolve, reject })),
    } }) },
  });
  const render = () => runner.render(useRepositoryBotForm, props);
  let form = render();
  form.setIsAddingRepoBot(true);
  form.setRepoBotName('Repo reviewer');
  form.setRepoBotAcpAgentId('repo-agent');
  form.setRepoBotExecutionMode('acp');
  form = render();
  assert.equal(form.canSubmit, false);
  form.handleSaveRepoCustomBot({ preventDefault() {} });
  assert.deepEqual(writes, []);
  props.inheritAgents = true;
  form = render();
  requests[0].resolve([]);
  await tick();
  assert.equal(render().canSubmit, false);
  assert.equal(requests.length, 1);
  props.inheritAgents = false;
  form = render();
  assert.equal(form.canSubmit, false);
  requests[1].resolve([]);
  await tick();
  form = render();
  assert.equal(form.canSubmit, true);
  form.handleSaveRepoCustomBot({ preventDefault() {} });
  assert.equal(writes[0][0], 'repo');
  assert.equal(writes[0][1].acpAgentId, 'repo-agent');
  assert.equal(writes[0][1].allowAcpSourceTransfer, false);
  assert.deepEqual(writes[0][1].acpConfigOptions, {});
});


test('failed model-dependent discovery remains blocked and resetting overrides recovers with defaults', async (t) => {
  const f = fixture(t);
  f.form.setFormAcpConfigOptions({ model: 'second' });
  let form = f.render();
  f.requests[0].resolve([model]);
  await tick();
  f.requests[1].reject(new Error('Model no longer supported'));
  await tick();
  form = f.render();
  assert.equal(form.canSubmit, false);
  assert.equal(form.acpConfig.error, 'Model no longer supported');
  submit(form);
  assert.deepEqual(f.writes, []);
  form.acpConfig.reset();
  form = f.render();
  assert.equal(form.canSubmit, false);
  f.requests[2].resolve([model]);
  await tick();
  form = f.render();
  assert.equal(form.canSubmit, true);
  assert.deepEqual(form.formAcpConfigOptions, {});
});
