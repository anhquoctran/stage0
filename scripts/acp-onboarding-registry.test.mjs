import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWithMocks, componentHarness, componentNodes } from './helpers/componentHarness.mjs';

const registryAgents = [
  'other-agent',
  'github-copilot-cli',
  'cursor',
  'antigravity-acp',
  'codex-acp',
  'grok-build',
  'claude-acp',
].map((id) => ({
  id,
  name: id,
  version: '1',
  description: '',
  distribution: { npx: { package: id } },
}));

const customAgent = {
  id: 'custom-agent',
  name: 'Custom Agent',
  source: 'custom',
  command: 'custom-agent',
  args: [],
};

async function visibleAgentIds(isOnboarding) {
  const harness = componentHarness();
  const source = new URL('../frontend/features/ai/components/ExternalAgentsTab.tsx', import.meta.url);
  const noop = () => {};
  const account = Object.fromEntries([
    'setAuthMethods', 'setAuthStatus', 'setSupportsAuthStatus', 'setReportedAgentInfo',
    'setSelectedAuthMethod', 'setLastSuccessfulSignIn', 'setIsCheckingAuth',
  ].map((name) => [name, noop]));
  const appServices = {
    externalAgents: { acpFetchRegistry: async () => ({ agents: registryAgents }) },
    platform: { capabilities: { externalAgents: true } },
  };
  const dependencies = {
    react: harness.react,
    '../../../core/services/runtime/useApplicationServices': { useApplicationServices: () => appServices },
    '../../git/store/useGitStore': { useGitStore: (selector) => selector({ currentRepo: null }) },
    '../store/useAiMcpStore': { useAiMcpStore: () => ({ externalAgents: [customAgent], updateExternalAgents: noop }) },
    '../utils/acpAuthHistory': { forgetAgentSignIn: noop, getLastSuccessfulSignIn: () => null },
    '../utils/acpRegistryAvailability': { registryUnavailableReason: () => undefined },
    '../utils/acpRegistryMetadata': { registryDistribution: () => '', safeProjectUrl: () => null },
    './external-agents/AcpAgentCard': {
      AcpAgentCard: ({ item }) => harness.react.createElement('div', { 'data-agent-id': item.id }),
    },
    './external-agents/AcpAgentDetails': { AcpAgentDetails: () => null },
    './external-agents/AcpAgentModalForm': { AcpAgentModalForm: () => null },
    './external-agents/AcpOnboardingProviderPicker': {
      AcpOnboardingProviderPicker: () => harness.react.createElement(
        'section',
        { 'data-provider-picker': 'true' },
        ...['openai', 'claude', 'antigravity', 'cursor-xai', 'copilot'].map((id) =>
          harness.react.createElement('button', { 'data-provider-id': id })
        ),
      ),
    },
    './external-agents/AcpRegistryActions': {
      AcpRegistryActions: ({ isOnboarding: onboarding }) =>
        harness.react.createElement('div', { 'data-onboarding-actions': String(onboarding) }),
    },
    './external-agents/AcpRegistryToolbar': {
      AcpRegistryToolbar: () => harness.react.createElement('div', { 'data-registry-toolbar': 'true' }),
    },
    './useAcpAgentAccount': { useAcpAgentAccount: () => account },
    './useAcpAgentPrompt': {
      useAcpAgentPrompt: () => ({ setPrompt: noop, setResponse: noop }),
    },
    './useCustomAcpAgentForm': {
      useCustomAcpAgentForm: () => ({
        addCustomAgent: noop,
        customName: '',
        setCustomName: noop,
        customCommand: '',
        setCustomCommand: noop,
        customArgs: '',
        setCustomArgs: noop,
      }),
    },
  };
  try {
    const { ExternalAgentsTab } = loadWithMocks(source, dependencies);
    const tree = await harness.render(ExternalAgentsTab, { isOnboarding });
    const nodes = componentNodes(tree);
    return {
      ids: nodes.filter((node) => node.props?.['data-agent-id']).map((node) => node.props['data-agent-id']),
      providers: nodes.filter((node) => node.props?.['data-provider-id']).map((node) => node.props['data-provider-id']),
      hasProviderPicker: nodes.some((node) => node.props?.['data-provider-picker']),
      hasRegistryToolbar: nodes.some((node) => node.props?.['data-registry-toolbar']),
      actionMode: nodes.find((node) => node.props?.['data-onboarding-actions'])?.props['data-onboarding-actions'],
    };
  } finally {
    harness.cleanup();
  }
}

test('onboarding ACP setup shows five provider buttons without registry search or list', async () => {
  const result = await visibleAgentIds(true);
  assert.deepEqual(result.providers, ['openai', 'claude', 'antigravity', 'cursor-xai', 'copilot']);
  assert.deepEqual(result.ids, []);
  assert.equal(result.hasProviderPicker, true);
  assert.equal(result.hasRegistryToolbar, false);
  assert.equal(result.actionMode, 'true');
});

test('AI Preferences keeps the full ACP registry and custom agents', async () => {
  const result = await visibleAgentIds(false);
  assert.deepEqual(result.ids, [
    'custom-agent', 'other-agent', 'github-copilot-cli', 'cursor', 'antigravity-acp',
    'codex-acp', 'grok-build', 'claude-acp',
  ]);
  assert.deepEqual(result.providers, []);
  assert.equal(result.hasProviderPicker, false);
  assert.equal(result.hasRegistryToolbar, true);
  assert.equal(result.actionMode, 'false');
});
