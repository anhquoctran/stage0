import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { loadWithMocks, componentHarness, componentNodes } from './helpers/componentHarness.mjs';

const { registryUnavailableReason } = loadWithMocks(new URL('../frontend/features/ai/utils/acpRegistryAvailability.ts', import.meta.url), {});
const entry = (binary) => ({ id: 'fixture', name: 'Fixture', version: '1', description: '', distribution: { binary } });

test('native agent availability follows every registry desktop OS/architecture, not Windows-only rules', () => {
  const binary = Object.fromEntries(['darwin-aarch64', 'darwin-x86_64', 'windows-aarch64', 'windows-x86_64', 'linux-aarch64', 'linux-x86_64', 'linux-arm', 'linux-riscv64', 'windows-x86'].map((target) => [target, {
    archive: `https://example.com/agent-${target}${target.startsWith('windows') || target.startsWith('darwin') ? '.zip' : '.tar.gz'}`,
    cmd: target.startsWith('windows') ? './bin/agent.exe' : './bin/agy_acp_server.par',
  }]));
  for (const target of Object.keys(binary)) assert.equal(registryUnavailableReason(entry(binary), target), undefined, target);
});

test('supports all archive forms and raw native downloads without requiring a .exe suffix on Unix', () => {
  for (const suffix of ['.zip', '.tar.gz', '.tgz', '.tar.bz2', '.tbz2', '']) {
    const agent = entry({ 'linux-aarch64': { archive: `https://example.com/agent${suffix}`, cmd: './agent' } });
    assert.equal(registryUnavailableReason(agent, 'linux-aarch64'), undefined, suffix);
  }
});

test('missing publisher architecture is explicit and never falls back to a different CPU', () => {
  const agent = entry({ 'darwin-x86_64': { archive: 'https://example.com/agent.zip', cmd: './agent' } });
  assert.equal(registryUnavailableReason(agent, 'darwin-aarch64'), 'No publisher package for darwin-aarch64');
  assert.match(registryUnavailableReason(agent), /Platform information is unavailable/);
});

test('package-manager agents remain available across platforms', () => {
  for (const manager of ['npx', 'uvx']) {
    for (const target of [undefined, 'linux-arm', 'darwin-aarch64', 'windows-aarch64']) {
      assert.equal(registryUnavailableReason({ distribution: { [manager]: { package: 'fixture' } } }, target), undefined);
    }
  }
});

test('invalid metadata, unsafe paths, HTTP downloads and unsupported installers are not offered', () => {
  for (const [target, archive, cmd] of [
    ['darwin-aarch64', 'http://example.com/agent.zip', './agent'],
    ['darwin-aarch64', 'https://example.com/agent.dmg', './agent'],
    ['linux-aarch64', 'https://example.com/agent.deb', './agent'],
    ['windows-aarch64', 'https://example.com/agent.zip', './agent.cmd'],
    ['linux-x86_64', 'https://example.com/agent.tar.gz', '../agent'],
    ['linux-x86_64', 'https://example.com/agent.tar.gz', '/agent'],
    ['linux-x86_64', 'https://example.com/agent.tar.gz', 'C:\\agent.exe'],
    ['linux-x86_64', 'https://user:pass@example.com/agent.tar.gz', './agent'],
  ]) {
    assert.ok(registryUnavailableReason(entry({ [target]: { archive, cmd } }), target), `${archive} ${cmd}`);
  }
});

test('the Registry screen offers Install and saves the native launch config on every desktop target', async () => {
  const source = new URL('../frontend/features/ai/components/ExternalAgentsTab.tsx', import.meta.url);
  for (const target of ['darwin-aarch64', 'darwin-x86_64', 'linux-aarch64', 'linux-x86_64', 'windows-aarch64', 'windows-x86_64']) {
    const harness = componentHarness(); const calls = []; const writes = [];
    const agent = entry({ [target]: { archive: 'https://example.com/agent.zip', cmd: target.startsWith('windows-') ? './agent.exe' : './agy_acp_server.par' } });
    const installed = { id: agent.id, name: agent.name, source: 'registry', command: '/fixture/agent', args: [], launchMode: 'binary' };
    const dependencies = {
      react: harness.react,
      '@tauri-apps/api/core': { isTauri: () => true, invoke: async (name, args) => {
        calls.push([name, args]);
        if (name === 'acp_fetch_registry') return { agents: [agent], supportedBinaryTarget: target };
        assert.equal(name, 'acp_prepare_registry_agent'); assert.deepEqual(args, { agentId: agent.id });
        return installed;
      } },
      '../store/useAiMcpStore': { useAiMcpStore: () => ({ externalAgents: [], updateExternalAgents: (agents) => writes.push(agents) }) },
      '../../git/store/useGitStore': { useGitStore: (selector) => selector({ currentRepo: null }) },
      '../utils/acpRegistryAvailability': { registryUnavailableReason },
      '../../../common/components/CustomSelect': { CustomSelect: () => null },
      './AcpRegistryAbout': { AcpRegistryAbout: () => null },
      './AcpRegistryProjectInfo': { AcpRegistryProjectInfo: () => null },
    };
    for (const [, name, path] of readFileSync(source, 'utf8').matchAll(/import \{ (\w+) \} from '([^']+\/icons\/[^']+)';/g)) dependencies[path] = { [name]: () => null };
    const { ExternalAgentsTab } = loadWithMocks(source, dependencies);
    try {
      const nodes = componentNodes(await harness.render(ExternalAgentsTab));
      const button = nodes.find((node) => node.type === 'button' && node.props.children.flat(Infinity).includes('Install'));
      assert.ok(button, target); assert.equal(button.props.disabled, false);
      button.props.onClick(); await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(writes, [[installed]], target);
      assert.equal(calls.length, 2);
    } finally { harness.cleanup(); }
  }
});
