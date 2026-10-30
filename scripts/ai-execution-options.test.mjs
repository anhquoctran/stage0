import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

function fixture(t, file) {
  const harness = componentHarness();
  t.after(() => harness.cleanup());
  const module = loadWithMocks(new URL(`../frontend/features/ai/components/${file}.tsx`, import.meta.url), {
    react: harness.react,
    '../../../common/components/CustomSelect': { CustomSelect: () => null },
  });
  return async (props) => componentNodes(await harness.render(module[file], props));
}

test('LLM Fast mode is absent without confirmed support, even with a stale enabled value', async (t) => {
  const render = fixture(t, 'AiModelExecutionOptions');
  for (const model of [undefined, { id: 'unknown', name: 'Unknown' }, { id: 'standard', name: 'Standard', supportsFastMode: false }]) {
    const nodes = await render({ model, fastMode: true, onFastModeChange: assert.fail, onReasoningEffortChange: assert.fail });
    assert.equal(nodes.some((node) => node.props?.role === 'switch'), false);
  }
});

test('supported LLM Fast mode is a toggle and changes the explicit boolean setting', async (t) => {
  const render = fixture(t, 'AiModelExecutionOptions');
  const changes = [];
  const nodes = await render({
    model: { id: 'fast', name: 'Fast', supportsFastMode: true }, fastMode: false,
    onFastModeChange: (value) => changes.push(value), onReasoningEffortChange: assert.fail,
  });
  const toggle = nodes.find((node) => node.props?.role === 'switch');
  assert.equal(toggle.props['aria-checked'], false);
  toggle.props.onClick();
  assert.deepEqual(changes, [true]);
});

test('ACP hides unavailable, incomplete and loading Fast mode options', async (t) => {
  const render = fixture(t, 'AcpReviewerConfigOptions');
  const base = { agent: { name: 'Agent' }, value: { fast: true } };
  const fast = { id: 'fast', name: 'Fast mode', reviewKind: 'fastMode', type: 'select', currentValue: 'off' };
  for (const [options, loading] of [
    [[], false],
    [[{ ...fast, options: [{ value: 'off', name: 'Off' }] }], false],
    [[{ ...fast, type: 'boolean', currentValue: false }], true],
  ]) {
    const nodes = await render({ ...base, state: { options, loading, error: null, updateOption: assert.fail } });
    assert.equal(nodes.some((node) => node.props?.role === 'switch'), false);
    assert.equal(nodes.some((node) => node.props?.['aria-label']?.startsWith('Fast mode')), false);
  }
});

test('ACP Fast mode toggle preserves the values advertised by the agent', async (t) => {
  const render = fixture(t, 'AcpReviewerConfigOptions');
  const option = {
    id: 'speed', name: 'Fast mode', reviewKind: 'fastMode', type: 'select', currentValue: 'disabled',
    options: [{ value: 'enabled', name: 'Enabled' }, { value: 'disabled', name: 'Disabled' }],
  };
  const changes = [];
  const nodes = await render({
    agent: { name: 'Agent' }, value: {},
    state: { options: [option], loading: false, error: null, updateOption: (_, value) => changes.push(value) },
  });
  const toggle = nodes.find((node) => node.props?.role === 'switch');
  assert.equal(toggle.props['aria-checked'], false);
  toggle.props.onClick();
  assert.deepEqual(changes, ['enabled']);
});
