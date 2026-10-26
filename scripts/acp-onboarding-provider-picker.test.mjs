import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, componentNodes, loadWithMocks } from './helpers/componentHarness.mjs';

const entries = [
  ['codex-acp', 'OpenAI'],
  ['claude-acp', 'Claude'],
  ['antigravity-acp', 'Antigravity'],
  ['cursor', 'Cursor'],
  ['grok-build', 'Grok Build'],
  ['github-copilot-cli', 'Copilot'],
].map(([id, name]) => ({
  id,
  name,
  version: '1',
  description: `${name} agent`,
  icon: `https://cdn.agentclientprotocol.com/registry/v1/${id}/${id}.svg`,
  distribution: { npx: { package: id } },
}));

const installedOpenAi = {
  id: 'codex-acp',
  name: 'OpenAI',
  source: 'registry',
  command: 'npx',
  args: ['codex-acp'],
};

async function renderPicker(externalAgents = []) {
  const harness = componentHarness();
  const source = new URL('../frontend/features/ai/components/external-agents/AcpOnboardingProviderPicker.tsx', import.meta.url);
  const { AcpOnboardingProviderPicker } = loadWithMocks(source, {
    react: harness.react,
    '../AgentIcon': { AgentIcon: () => null },
    '../../utils/acpRegistryAvailability': { registryUnavailableReason: () => undefined },
  });
  const installed = [];
  const managed = [];
  const props = {
    registry: entries,
    externalAgents,
    busyId: null,
    isLoading: false,
    canLaunchAgents: true,
    onInstall: (entry) => installed.push(entry.id),
    onManage: (agent, entry) => managed.push([agent.id, entry.id]),
  };
  return {
    harness,
    installed,
    managed,
    component: AcpOnboardingProviderPicker,
    props,
    render: () => harness.render(AcpOnboardingProviderPicker, props),
  };
}

function buttons(tree) {
  return componentNodes(tree).filter((node) => node.type === 'button');
}

test('onboarding presents five provider buttons and installs the selected provider', async () => {
  const view = await renderPicker();
  try {
    const initialButtons = buttons(await view.render());
    assert.equal(initialButtons.length, 5);
    assert.deepEqual(initialButtons.map((button) => button.props['aria-label']), [
      'Install OpenAI',
      'Install Claude',
      'Install Antigravity',
      'Cursor / xAI: choose an agent',
      'Install Copilot',
    ]);

    initialButtons[0].props.onClick();
    assert.deepEqual(view.installed, ['codex-acp']);
  } finally {
    view.harness.cleanup();
  }
});

test('an installed provider opens management and the Cursor/xAI button exposes its two agents', async () => {
  const view = await renderPicker([installedOpenAi]);
  try {
    const initialButtons = buttons(await view.render());
    initialButtons.find((button) => button.props['aria-label'] === 'Manage OpenAI').props.onClick();
    assert.deepEqual(view.managed, [['codex-acp', 'codex-acp']]);

    initialButtons.find((button) => button.props['aria-label'].startsWith('Cursor / xAI:')).props.onClick();
    const expandedButtons = buttons(await view.render());
    assert.equal(expandedButtons.length, 7);
    assert.ok(expandedButtons.some((button) => button.props['aria-label'] === 'Install Cursor'));
    assert.ok(expandedButtons.some((button) => button.props['aria-label'] === 'Install Grok Build'));
  } finally {
    view.harness.cleanup();
  }
});
