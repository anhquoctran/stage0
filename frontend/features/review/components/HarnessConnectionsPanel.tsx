import React, { useEffect, useState } from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { useAiMcpStore } from '../../ai/store/useAiMcpStore';
import { useHarnessConnectionStore } from '../store/useHarnessConnectionStore';
import { mcpConnectionKey } from '../utils/mcpConnectionKey';
import type { HarnessConnectionsPanelProps } from '../types/HarnessConnectionsPanelProps';

const CLI_OPTIONS = [
  { value: 'claude', label: 'Claude Code' }, { value: 'gh_copilot', label: 'GitHub CLI' },
  { value: 'gcloud', label: 'Google Cloud CLI' }, { value: 'grok', label: 'Grok CLI' },
];

export const HarnessConnectionsPanel: React.FC<HarnessConnectionsPanelProps> = ({ draftServers } = {}) => {
  const committedServers = useAiMcpStore((state) => state.mcpServers);
  const servers = draftServers || committedServers;
  const { mcp, cli, cliError, isInspectingCli, discover, inspectCli } = useHarnessConnectionStore();
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [cliType, setCliType] = useState('claude');
  const connectionKeys = servers.map(mcpConnectionKey).join('|');
  useEffect(() => { setConsent({}); }, [connectionKeys]);

  return <details className="border border-surface1 bg-base p-3 text-xs">
    <summary className="font-semibold cursor-pointer">External MCP / CLI connectors · preparation</summary>
    <div className="mt-3 space-y-3">
      <p className="text-subtext0">Discovery is not authorization. External tools and CLI agents are not attached to review runs. No source, roots, credentials or repository paths are sent by these checks.</p>
      <p className="text-subtext0">MCP: Streamable HTTP, revision 2025-11-25 only; no OAuth, legacy SSE, automatic stdio launch, sampling or tool execution. Temporary sessions receive best-effort cleanup; no persistent connector is kept.</p>
      {servers.length === 0 && <p>No MCP connections configured. Add one in AI Preferences → MCP Servers.</p>}
      {servers.map((server) => {
        const saved = committedServers.find((item) => item.id === server.id);
        const pendingCommit = !saved || mcpConnectionKey(saved) !== mcpConnectionKey(server);
        const state = mcp[server.id];
        const current = state?.requestKey === mcpConnectionKey(server) ? state : undefined;
        return <section key={server.id} className="border border-surface0 p-3 space-y-2">
          <p className="font-semibold break-words">{server.name} · {server.type} · {server.enabled ? 'Configured on' : 'Configured off'}</p>
          {pendingCommit && <p className="text-subtext0">Apply or OK to save this connection before network discovery.</p>}
          {server.type === 'http' && !pendingCommit ? <>
            <p className="font-mono text-[11px] text-subtext0 break-all">{server.url}</p>
            <label className="flex items-start gap-2"><input type="checkbox" disabled={!server.enabled || current?.status === 'discovering'} checked={!!consent[server.id]} onChange={(event) => setConsent((value) => ({ ...value, [server.id]: event.target.checked }))} className="accent-primary mt-0.5" /><span>Allow source-free network discovery at this endpoint. No tool will be called or enabled.</span></label>
            <button type="button" disabled={!server.enabled || !consent[server.id] || current?.status === 'discovering'} onClick={() => { setConsent((value) => ({ ...value, [server.id]: false })); void discover(server, true); }} className="border border-surface1 px-3 py-1.5 disabled:opacity-40 rounded-sm">{current?.status === 'discovering' ? 'Discovering…' : 'Discover tools'}</button>
            {current?.error && <p role="alert" className="text-red whitespace-pre-wrap break-words">{current.error}</p>}
            {current?.report && <div className="space-y-1" role="status">
              <p>{current.report.tools.length} tools discovered from {current.report.serverName} / {current.report.serverVersion}. Not attached to harness.</p>
              <p className="font-mono text-[10px] text-subtext0 break-all">Catalog {current.report.catalogFingerprint}</p>
              <ul className="max-h-32 overflow-auto space-y-1">{current.report.tools.map((tool) => <li key={tool.namespacedName} className="break-all"><code>{tool.name}</code> · <span className="text-subtext0">{tool.namespacedName} · read-only hint: {tool.readOnlyHint === null ? 'unspecified' : String(tool.readOnlyHint)} (untrusted)</span></li>)}</ul>
            </div>}
          </> : server.type !== 'http' && <p className="text-subtext0">{server.type === 'stdio' ? 'Saved launch configuration only. Starting this executable could install packages or access the host. A process-isolation and explicit launch-approval adapter is still required.' : 'Legacy HTTP+SSE is not supported by this discovery client. Configure a Streamable HTTP endpoint instead.'}</p>}
        </section>;
      })}
      <section className="border-t border-surface0 pt-3 space-y-2">
        <p className="font-semibold">CLI harness preflight (no execution)</p>
        <CustomSelect value={cliType} onChange={setCliType} options={CLI_OPTIONS} aria-label="CLI for harness preflight" className="w-full" buttonClassName="w-full" dropdownWidth="w-full" align="left" />
        <button type="button" disabled={isInspectingCli} onClick={() => void inspectCli(cliType)} className="border border-surface1 px-3 py-1.5 disabled:opacity-40 rounded-sm">{isInspectingCli ? 'Inspecting PATH…' : 'Inspect executable'}</button>
        {cliError && <p role="alert" className="text-red">{cliError}</p>}
        {cli?.cliType === cliType && <div role="status" className="space-y-1 text-subtext0"><p>{cli.executableFound ? 'Executable found' : 'Executable not found'} · not attached</p><p className="font-mono break-all">{cli.executablePath}</p><p>{cli.message}</p><p>Required wrapper contract: <code>{cli.requiredProtocol}</code></p></div>}
      </section>
    </div>
  </details>;
};
