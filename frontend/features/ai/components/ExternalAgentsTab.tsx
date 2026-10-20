import React, { useEffect, useMemo, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { Search } from '../../../common/components/icons/Search';
import { Plus } from '../../../common/components/icons/Plus';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { ExternalLink } from '../../../common/components/icons/ExternalLink';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { X } from '../../../common/components/icons/X';
import { Bot } from '../../../common/components/icons/Bot';
import type { AiSettingsTabProps } from '../types/AiSettingsTabProps';
import type { AcpAgentConfig, AcpRegistryAgent } from '../types/AcpAgentConfig';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { useGitStore } from '../../git/store/useGitStore';

type AuthMethod = { id: string; name?: string; description?: string; type?: string };
type Filter = 'all' | 'installed' | 'not-installed';

function canInstallFromRegistry(agent: AcpRegistryAgent): boolean {
  return Boolean(agent.distribution.npx || agent.distribution.uvx);
}

function isRegistryIconUrl(icon?: string): icon is string {
  if (!icon) return false;
  try {
    const url = new URL(icon);
    return url.protocol === 'https:' && url.hostname === 'cdn.agentclientprotocol.com' && url.pathname.startsWith('/registry/v1/');
  } catch {
    return false;
  }
}

function AgentIcon({ icon }: { icon?: string }) {
  const iconUrl = isRegistryIconUrl(icon) ? icon : undefined;
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [iconUrl]);

  if (!iconUrl || failed) return <Bot aria-hidden="true" className="h-4 w-4 shrink-0 text-subtext0" />;
  return <img src={iconUrl} alt="" aria-hidden="true" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-4 w-4 shrink-0 object-contain" />;
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-2xl border border-surface2 bg-mantle text-text shadow-2xl">
        <header className="flex items-center justify-between border-b border-surface1 px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="border border-transparent p-1 text-subtext0 hover:border-surface2 hover:text-text"><X className="h-4 w-4" /></button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto p-4">{children}</div>
      </section>
    </div>
  );
}

export const ExternalAgentsTab: React.FC<AiSettingsTabProps> = ({ draftSettings } = {}) => {
  const store = useAiMcpStore();
  const currentRepoPath = useGitStore((state) => state.currentRepo?.local_path ?? null);
  const externalAgents = draftSettings?.externalAgents ?? store.externalAgents;
  const updateExternalAgents = draftSettings?.updateExternalAgents ?? store.updateExternalAgents;
  const [registry, setRegistry] = useState<AcpRegistryAgent[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailAgent, setDetailAgent] = useState<AcpAgentConfig | null>(null);
  const [detailRegistryEntry, setDetailRegistryEntry] = useState<AcpRegistryAgent | null>(null);
  const [authMethods, setAuthMethods] = useState<AuthMethod[]>([]);
  const [selectedAuthMethod, setSelectedAuthMethod] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [prompt, setPrompt] = useState('What can you help me with?');
  const [response, setResponse] = useState('');
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);
  const [removePending, setRemovePending] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCommand, setCustomCommand] = useState('');
  const [customArgs, setCustomArgs] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    invoke<{ agents: AcpRegistryAgent[] }>('acp_fetch_registry')
      .then((result) => { if (!cancelled) { setRegistry(result.agents); setError(null); } })
      .catch((cause) => { if (!cancelled) setError(String(cause)); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visibleAgents = useMemo(() => {
    const search = query.trim().toLowerCase();
    const installedIds = new Set(externalAgents.map((agent) => agent.id));
    const entries = registry.filter((agent) => {
      const installed = installedIds.has(agent.id);
      if (filter === 'installed' && !installed) return false;
      if (filter === 'not-installed' && installed) return false;
      return !search || `${agent.name} ${agent.id} ${agent.description}`.toLowerCase().includes(search);
    });
    if (filter === 'not-installed') return entries;
    const custom = externalAgents.filter((agent) => agent.source === 'custom' && (!search || `${agent.name} ${agent.id} ${agent.command}`.toLowerCase().includes(search)));
    return [...custom, ...entries];
  }, [registry, externalAgents, filter, query]);

  const install = async (entry: AcpRegistryAgent) => {
    setBusyId(entry.id); setError(null);
    try {
      const config = await invoke<AcpAgentConfig>('acp_prepare_registry_agent', { agentId: entry.id });
      updateExternalAgents([...externalAgents.filter((agent) => agent.id !== config.id), config]);
    } catch (cause) { setError(String(cause)); }
    finally { setBusyId(null); }
  };

  const openDetails = (agent: AcpAgentConfig, entry?: AcpRegistryAgent) => {
    setDetailAgent(agent); setDetailRegistryEntry(entry ?? null); setAuthMethods([]); setSelectedAuthMethod(''); setPrompt('What can you help me with?'); setResponse(''); setRemovePending(false); setError(null); setNotice(null);
  };

  const discoverAuth = async () => {
    if (!detailAgent) return;
    setIsCheckingAuth(true); setError(null); setNotice(null); setAuthMethods([]); setSelectedAuthMethod('');
    try {
      const methods = await invoke<AuthMethod[]>('acp_agent_auth_methods', { config: detailAgent });
      setAuthMethods(methods); setSelectedAuthMethod(methods[0]?.id || '');
      if (!methods.length) setError('This agent does not advertise an ACP sign-in flow. Try its prompt directly.');
    } catch (cause) { setError(String(cause)); }
    finally { setIsCheckingAuth(false); }
  };

  const signIn = async () => {
    if (!detailAgent || !selectedAuthMethod) return;
    setBusyId(detailAgent.id); setError(null); setNotice(null);
    try {
      await invoke('acp_agent_authenticate', { config: detailAgent, methodId: selectedAuthMethod });
      setNotice('Sign-in completed. The agent manages its own subscription session.');
    } catch (cause) { setError(String(cause)); }
    finally { setBusyId(null); }
  };

  const sendPrompt = async () => {
    if (!detailAgent || !prompt.trim()) return;
    setIsSendingPrompt(true); setError(null); setResponse('');
    try {
      const result = await invoke<string>('acp_agent_prompt', { config: detailAgent, prompt, cwd: currentRepoPath });
      setResponse(result);
    } catch (cause) { setError(String(cause)); }
    finally { setIsSendingPrompt(false); }
  };

  const addCustomAgent = (event: React.FormEvent) => {
    event.preventDefault();
    if (!customName.trim() || !customCommand.trim()) { setError('Name and command are required.'); return; }
    const config: AcpAgentConfig = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      source: 'custom',
      command: customCommand.trim(),
      args: customArgs.split(/\r?\n/).map((arg) => arg.trim()).filter(Boolean),
    };
    updateExternalAgents([...externalAgents, config]);
    setCustomName(''); setCustomCommand(''); setCustomArgs(''); setIsCustomOpen(false); setError(null);
  };

  const removeAgent = () => {
    if (!detailAgent) return;
    updateExternalAgents(externalAgents.filter((agent) => agent.id !== detailAgent.id));
    setDetailAgent(null); setDetailRegistryEntry(null); setRemovePending(false);
  };

  const registryConfig = (entry: AcpRegistryAgent) => externalAgents.find((agent) => agent.id === entry.id);

  return (
    <div className="space-y-4 text-text">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">External Agents</h2>
          <p className="mt-1 max-w-3xl text-xs text-subtext0">Find ACP agents, connect with their own account, and send a prompt. Subscription sign-in stays with the agent and does not become an LLM provider API key.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setIsCustomOpen(true)} className="flex items-center gap-1.5 border border-surface2 px-3 py-1.5 text-xs hover:bg-surface0"><Plus className="h-3.5 w-3.5" /> Add custom</button>
          <button type="button" disabled={isLoading} onClick={() => { setError(null); setIsLoading(true); void invoke<{ agents: AcpRegistryAgent[] }>('acp_fetch_registry').then((result) => setRegistry(result.agents)).catch((cause) => setError(String(cause))).finally(() => setIsLoading(false)); }} className="flex items-center gap-1.5 border border-surface1 px-2.5 py-1.5 text-xs text-subtext0 hover:text-text disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </div>

      {error && <p role="status" className="border border-yellow/40 bg-yellow/5 px-3 py-2 text-xs text-yellow">{error}</p>}
      {!isTauri() && <p className="border border-surface1 px-3 py-2 text-xs text-subtext0">ACP agents need the Stage0 desktop app to launch a local agent process.</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface1 pb-3">
        <label className="flex min-w-56 flex-1 items-center gap-2 border border-surface1 bg-base px-2.5 py-1.5 text-subtext0">
          <Search className="h-3.5 w-3.5" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ACP Registry…" className="w-full bg-transparent text-xs text-text outline-none placeholder:text-subtext0" />
        </label>
        <div className="flex border border-surface1 text-xs">
          {([['all', 'All'], ['installed', 'Added'], ['not-installed', 'Not added']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={`border-r border-surface1 px-3 py-1.5 last:border-r-0 ${filter === id ? 'bg-surface1 text-text' : 'text-subtext0 hover:text-text'}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-surface1 border-y border-surface1">
        {isLoading && !registry.length && <p className="px-3 py-8 text-center text-xs text-subtext0">Loading ACP Registry…</p>}
        {!isLoading && !visibleAgents.length && <p className="px-3 py-8 text-center text-xs text-subtext0">No agents match this view.</p>}
        {visibleAgents.map((item) => {
          const isCustom = 'source' in item && item.source === 'custom';
          const entry = isCustom ? undefined : item as AcpRegistryAgent;
          const installed = isCustom ? item as AcpAgentConfig : registryConfig(item as AcpRegistryAgent);
          const name = isCustom ? (item as AcpAgentConfig).name : (item as AcpRegistryAgent).name;
          const version = isCustom ? undefined : (item as AcpRegistryAgent).version;
          const description = isCustom ? (item as AcpAgentConfig).command : (item as AcpRegistryAgent).description;
          const installable = !isCustom && canInstallFromRegistry(entry!);
          return (
            <article key={`${isCustom ? 'custom' : 'registry'}-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <button type="button" onClick={() => installed ? openDetails(installed, entry) : setError(installable ? 'Add this agent first to configure or send a prompt.' : 'This Registry entry is a platform binary, which Stage0 cannot install in this build.')} className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2 text-sm font-medium"><AgentIcon icon={entry?.icon} /> <span className="truncate">{name}</span>{version && <span className="text-xs text-subtext0">v{version}</span>}{installed && <span className="border border-green/40 px-1.5 py-0.5 text-[10px] text-green">Added</span>}</span>
                <span className="mt-1 block truncate text-[11px] text-subtext0">{description}</span>
              </button>
              {installed ? <button type="button" onClick={() => openDetails(installed, entry)} className="shrink-0 border border-surface2 px-3 py-1.5 text-xs hover:bg-surface0">Manage</button>
                : installable ? <button type="button" disabled={busyId === item.id || !isTauri()} onClick={() => void install(entry!)} className="shrink-0 border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs text-brand hover:bg-brand/15 disabled:opacity-45">{busyId === item.id ? 'Adding…' : 'Add'}</button>
                  : <span className="shrink-0 text-[10px] text-subtext0">Binary package unavailable</span>}
            </article>
          );
        })}
      </div>
      <p className="text-[11px] text-subtext0">Adding an <code className="font-mono">npx</code> or <code className="font-mono">uvx</code> agent saves its launch config; the package downloads on first launch. Removing it deletes that config, while its local package cache may remain. ACP Registry entries distributed only as native binaries are listed but cannot be added here yet.</p>

      {detailAgent && <Modal title={detailAgent.name} onClose={() => { setDetailAgent(null); setDetailRegistryEntry(null); }}>
          <div className="space-y-4">
          {error && <p role="status" className="border border-yellow/40 bg-yellow/5 px-3 py-2 text-xs text-yellow">{error}</p>}
          {notice && <p role="status" className="border border-green/40 bg-green/5 px-3 py-2 text-xs text-green">{notice}</p>}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm font-semibold">{detailAgent.name}{detailAgent.version ? ` · ${detailAgent.version}` : ''}</p><p className="mt-1 text-xs text-subtext0">{detailAgent.description || 'Custom ACP agent'} · {detailAgent.command} {detailAgent.args.join(' ')}</p></div>
            <button type="button" onClick={() => setRemovePending(true)} className="flex items-center gap-1.5 border border-red/40 px-2.5 py-1.5 text-xs text-red hover:bg-red/10"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
          </div>
          {detailRegistryEntry?.website && <a href={detailRegistryEntry.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline">Agent website <ExternalLink className="h-3 w-3" /></a>}
          {removePending && <div className="flex flex-wrap items-center justify-between gap-2 border border-red/40 bg-red/5 p-3 text-xs"><span>Remove this launch config from Stage0? Its package cache may remain on this computer.</span><div className="flex gap-2"><button type="button" onClick={() => setRemovePending(false)} className="border border-surface2 px-2.5 py-1.5">Keep</button><button type="button" onClick={removeAgent} className="border border-red/50 px-2.5 py-1.5 text-red">Remove from Stage0</button></div></div>}
          <section className="space-y-2 border-t border-surface1 pt-4">
            <h3 className="text-xs font-semibold">Sign in with ACP</h3>
            <p className="text-[11px] text-subtext0">The agent stores its own account session. Stage0 does not read or save subscription credentials.</p>
            {!authMethods.length ? <button type="button" disabled={isCheckingAuth || !isTauri()} onClick={() => void discoverAuth()} className="border border-surface2 px-3 py-1.5 text-xs disabled:opacity-50">{isCheckingAuth ? 'Checking…' : 'Check sign-in options'}</button> : <div className="flex flex-wrap gap-2">
              <select value={selectedAuthMethod} onChange={(event) => setSelectedAuthMethod(event.target.value)} className="min-w-40 border border-surface1 bg-base px-2 py-1.5 text-xs">{authMethods.map((method) => <option key={method.id} value={method.id}>{method.name || method.id}{method.type === 'terminal' ? ' · Interactive terminal' : ''}</option>)}</select>
              <button type="button" disabled={busyId === detailAgent.id || !isTauri() || authMethods.find((method) => method.id === selectedAuthMethod)?.type === 'terminal'} onClick={() => void signIn()} className="border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs text-brand disabled:opacity-50">{busyId === detailAgent.id ? 'Connecting…' : 'Connect account'}</button>
            </div>}
            {authMethods.find((method) => method.id === selectedAuthMethod)?.type === 'terminal' && <p className="text-[11px] text-subtext0">This agent offers terminal-based sign-in, which Stage0 does not support yet.</p>}
          </section>
          <p className="border border-surface1 px-3 py-2 text-[11px] text-subtext0">When a repository is open, the agent starts there. Stage0 does not yet provide ACP file operations or interactive terminals, so the agent needs its own tools to work with project files.</p>
          <section className="space-y-2 border-t border-surface1 pt-4">
            <h3 className="text-xs font-semibold">Send a prompt</h3>
            <p className="break-all text-[11px] text-subtext0">Working directory: {currentRepoPath || 'No repository open; using Stage0’s working directory.'}</p>
            <textarea rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} className="w-full resize-y border border-surface1 bg-base px-2.5 py-2 text-xs outline-none focus:border-surface2" />
            <button type="button" disabled={isSendingPrompt || !prompt.trim() || !isTauri()} onClick={() => void sendPrompt()} className="border border-surface2 px-3 py-1.5 text-xs disabled:opacity-50">{isSendingPrompt ? 'Waiting for agent…' : 'Send prompt'}</button>
            {response && <pre className="max-h-64 overflow-auto whitespace-pre-wrap border border-surface1 bg-base p-3 text-xs">{response}</pre>}
          </section>
        </div>
      </Modal>}

      {isCustomOpen && <Modal title="Add custom ACP agent" onClose={() => setIsCustomOpen(false)}>
        <form onSubmit={addCustomAgent} className="space-y-3">
          {error && <p role="status" className="border border-yellow/40 bg-yellow/5 px-3 py-2 text-xs text-yellow">{error}</p>}
          <label className="block text-xs">Name<input value={customName} onChange={(event) => setCustomName(event.target.value)} className="mt-1 w-full border border-surface1 bg-base px-2.5 py-2 text-xs" /></label>
          <label className="block text-xs">Command<input value={customCommand} onChange={(event) => setCustomCommand(event.target.value)} placeholder="npx" className="mt-1 w-full border border-surface1 bg-base px-2.5 py-2 font-mono text-xs" /></label>
          <label className="block text-xs">Arguments <span className="text-subtext0">(one per line)</span><textarea rows={4} value={customArgs} onChange={(event) => setCustomArgs(event.target.value)} placeholder={'-y\n@vendor/agent-acp'} className="mt-1 w-full border border-surface1 bg-base px-2.5 py-2 font-mono text-xs" /></label>
          <p className="text-[11px] text-subtext0">Only add agents you trust. Stage0 starts this command locally and communicates over ACP stdio.</p>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setIsCustomOpen(false)} className="border border-surface2 px-3 py-1.5 text-xs">Cancel</button><button type="submit" className="border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs text-brand">Add agent</button></div>
        </form>
      </Modal>}
    </div>
  );
};
