import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { Search } from '../../../common/components/icons/Search';
import { Plus } from '../../../common/components/icons/Plus';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { ExternalLink } from '../../../common/components/icons/ExternalLink';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { X } from '../../../common/components/icons/X';
import { Bot } from '../../../common/components/icons/Bot';
import { ChevronLeft } from '../../../common/components/icons/ChevronLeft';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { AcpRegistryAbout } from './AcpRegistryAbout';
import { AcpRegistryProjectInfo } from './AcpRegistryProjectInfo';
import type { AiSettingsTabProps } from '../types/AiSettingsTabProps';
import type { AcpAgentConfig, AcpRegistryAgent } from '../types/AcpAgentConfig';
import type { AcpAgentConnectionInfo } from '../types/AcpAgentConnectionInfo';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { useGitStore } from '../../git/store/useGitStore';
import { registryUnavailableReason } from '../utils/acpRegistryAvailability';

type AuthMethod = { id: string; name?: string; description?: string; type?: string };
type Filter = 'all' | 'installed' | 'not-installed';
type AcpRegistryResponse = { agents: AcpRegistryAgent[]; supportedBinaryTarget?: string | null };

function isRegistryIconUrl(icon?: string): icon is string {
  if (!icon) return false;
  try {
    const url = new URL(icon);
    return url.protocol === 'https:'
      && url.hostname === 'cdn.agentclientprotocol.com'
      && /^\/registry\/v1\/[a-zA-Z0-9._-]+\/[a-z0-9-]+\.svg$/.test(url.pathname)
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

function safeProjectUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function registryDistribution(entry: AcpRegistryAgent): string {
  for (const manager of ['npx', 'uvx']) {
    const config = entry.distribution[manager];
    if (!config || typeof config !== 'object' || Array.isArray(config)) continue;
    const details = config as Record<string, unknown>;
    const packageName = typeof details.package === 'string' ? details.package : undefined;
    if (!packageName) continue;
    const args = Array.isArray(details.args)
      ? details.args.filter((arg): arg is string => typeof arg === 'string').join(' ')
      : '';
    return `${manager} ${packageName}${args ? ` ${args}` : ''}`;
  }

  const binaries = entry.distribution.binary;
  if (binaries && typeof binaries === 'object' && !Array.isArray(binaries)) {
    const targets = Object.entries(binaries as Record<string, unknown>).map(([target, value]) => {
      const command = value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>).cmd
        : undefined;
      return typeof command === 'string' ? `${target} · ${command}` : target;
    });
    if (targets.length) return targets.join(', ');
  }

  return Object.keys(entry.distribution).join(', ') || 'Not specified';
}

function isProtocolAuthMethod(method?: AuthMethod): boolean {
  return !method?.type || method.type === 'agent';
}

const registryIconCache = new Map<string, Promise<string>>();

function fetchRegistryIcon(iconUrl: string): Promise<string> {
  let cached = registryIconCache.get(iconUrl);
  if (!cached) {
    cached = invoke<string>('acp_fetch_registry_icon', { iconUrl }).catch((error: unknown) => {
      registryIconCache.delete(iconUrl);
      throw error;
    });
    registryIconCache.set(iconUrl, cached);
  }
  return cached;
}

function AgentIcon({ icon }: { icon?: string }) {
  const iconUrl = isRegistryIconUrl(icon) ? icon : undefined;
  const [iconData, setIconData] = useState<{ sourceUrl: string; dataUrl: string }>();
  const [loadedDataUrl, setLoadedDataUrl] = useState<string>();
  const [failedSourceUrl, setFailedSourceUrl] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    if (!iconUrl) return () => { cancelled = true; };
    void fetchRegistryIcon(iconUrl)
      .then((dataUrl) => { if (!cancelled) setIconData({ sourceUrl: iconUrl, dataUrl }); })
      .catch(() => { if (!cancelled) setFailedSourceUrl(iconUrl); });
    return () => { cancelled = true; };
  }, [iconUrl]);

  const dataUrl = iconData && iconData.sourceUrl === iconUrl ? iconData.dataUrl : undefined;
  if (!iconUrl || failedSourceUrl === iconUrl || !dataUrl) return <Bot aria-hidden="true" className="h-4 w-4 shrink-0 text-subtext0" />;

  const iconMask = `url("${dataUrl}")`;
  return <>
    <img src={dataUrl} alt="" aria-hidden="true" onLoad={() => setLoadedDataUrl(dataUrl)} onError={() => setFailedSourceUrl(iconUrl)} className="hidden" />
    {loadedDataUrl === dataUrl ? <span aria-hidden="true" className="h-4 w-4 shrink-0 bg-subtext0" style={{
      maskImage: iconMask,
      WebkitMaskImage: iconMask,
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center',
      maskSize: 'contain',
      WebkitMaskSize: 'contain',
    }} /> : <Bot aria-hidden="true" className="h-4 w-4 shrink-0 text-subtext0" />}
  </>;
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

type ExternalAgentsTabProps = AiSettingsTabProps & { onBackToOverview?: () => void };

export const ExternalAgentsTab: React.FC<ExternalAgentsTabProps> = ({ draftSettings, onBackToOverview } = {}) => {
  const store = useAiMcpStore();
  const currentRepoPath = useGitStore((state) => state.currentRepo?.local_path ?? null);
  const externalAgents = draftSettings?.externalAgents ?? store.externalAgents;
  const updateExternalAgents = draftSettings?.updateExternalAgents ?? store.updateExternalAgents;
  const [registry, setRegistry] = useState<AcpRegistryAgent[]>([]);
  const [supportedBinaryTarget, setSupportedBinaryTarget] = useState<string | undefined>();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailAgent, setDetailAgent] = useState<AcpAgentConfig | null>(null);
  const [detailRegistryEntry, setDetailRegistryEntry] = useState<AcpRegistryAgent | null>(null);
  const [authMethods, setAuthMethods] = useState<AuthMethod[]>([]);
  const [authStatus, setAuthStatus] = useState<AcpAgentConnectionInfo['authStatus']>(null);
  const [supportsAuthStatus, setSupportsAuthStatus] = useState(false);
  const [reportedAgentInfo, setReportedAgentInfo] = useState<AcpAgentConnectionInfo['agentInfo']>(null);
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
  const connectionRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    invoke<AcpRegistryResponse>('acp_fetch_registry')
      .then((result) => { if (!cancelled) { setRegistry(result.agents); setSupportedBinaryTarget(result.supportedBinaryTarget ?? undefined); setError(null); } })
      .catch((cause) => { if (!cancelled) setError(String(cause)); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const applyConnectionInfo = useCallback((info: AcpAgentConnectionInfo) => {
    setAuthMethods(info.authMethods);
    setSelectedAuthMethod(info.authMethods[0]?.id || '');
    setAuthStatus(info.authStatus);
    setSupportsAuthStatus(info.supportsAuthStatus);
    setReportedAgentInfo(info.agentInfo);
  }, []);

  const refreshAgentConnection = useCallback(async (agent: AcpAgentConfig): Promise<AcpAgentConnectionInfo | null> => {
    const requestId = ++connectionRequestRef.current;
    setIsCheckingAuth(true);
    setError(null);
    try {
      const info = await invoke<AcpAgentConnectionInfo>('acp_agent_connection_info', { config: agent });
      if (requestId === connectionRequestRef.current) applyConnectionInfo(info);
      return requestId === connectionRequestRef.current ? info : null;
    } catch (cause) {
      if (requestId === connectionRequestRef.current) {
        setAuthMethods([]);
        setAuthStatus(null);
        setSupportsAuthStatus(false);
        setReportedAgentInfo(null);
        setError(`Could not check this agent's account status: ${String(cause)}`);
      }
      return null;
    } finally {
      if (requestId === connectionRequestRef.current) setIsCheckingAuth(false);
    }
  }, [applyConnectionInfo]);

  useEffect(() => {
    if (!detailAgent) return;
    setAuthMethods([]);
    setAuthStatus(null);
    setSupportsAuthStatus(false);
    setReportedAgentInfo(null);
    if (isTauri()) void refreshAgentConnection(detailAgent);
    return () => { connectionRequestRef.current += 1; };
  }, [detailAgent, refreshAgentConnection]);

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
    setDetailAgent(agent); setDetailRegistryEntry(entry ?? null); setAuthMethods([]); setAuthStatus(null); setSupportsAuthStatus(false); setReportedAgentInfo(null); setSelectedAuthMethod(''); setPrompt('What can you help me with?'); setResponse(''); setRemovePending(false); setError(null); setNotice(null);
    setIsCheckingAuth(isTauri());
  };

  const signIn = async () => {
    if (!detailAgent || !selectedAuthMethod) return;
    setBusyId(detailAgent.id); setError(null); setNotice(null);
    try {
      await invoke('acp_agent_authenticate', { config: detailAgent, methodId: selectedAuthMethod });
      setNotice('Sign-in completed. Refreshing the agent-reported account status…');
      await refreshAgentConnection(detailAgent);
      setNotice('Sign-in completed. The agent manages its own account session.');
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
  const selectedAuthOption = authMethods.find((method) => method.id === selectedAuthMethod);
  const projectWebsiteUrl = safeProjectUrl(detailRegistryEntry?.website);
  const projectRepositoryUrl = safeProjectUrl(detailRegistryEntry?.repository);
  const projectLicenseUrl = safeProjectUrl(detailRegistryEntry?.licenseUrl);

  return (
    <div className="space-y-2 text-text">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {onBackToOverview ? <button type="button" onClick={onBackToOverview} className="inline-flex items-center gap-1 text-xs text-subtext0 transition-colors hover:text-text">
          <ChevronLeft className="h-3.5 w-3.5" /> AI overview
        </button> : <span />}
        <div className="flex flex-wrap items-center gap-2">
          <AcpRegistryAbout />
          <button type="button" onClick={() => setIsCustomOpen(true)} className="flex items-center gap-1.5 border border-surface2 px-3 py-1.5 text-xs hover:bg-surface0"><Plus className="h-3.5 w-3.5" /> Add custom</button>
          <button type="button" disabled={isLoading} onClick={() => { setError(null); setIsLoading(true); void invoke<AcpRegistryResponse>('acp_fetch_registry').then((result) => { setRegistry(result.agents); setSupportedBinaryTarget(result.supportedBinaryTarget ?? undefined); }).catch((cause) => setError(String(cause))).finally(() => setIsLoading(false)); }} className="flex items-center gap-1.5 border border-surface1 px-2.5 py-1.5 text-xs text-subtext0 hover:text-text disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </div>

      {error && <p role="status" className="border border-yellow/40 bg-yellow/5 px-3 py-2 text-xs text-yellow">{error}</p>}
      {!isTauri() && <p className="border border-surface1 px-3 py-2 text-xs text-subtext0">ACP agents need the Stage0 desktop app to launch a local agent process.</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <label className="flex min-w-56 flex-1 items-center gap-2 border border-surface1 bg-base px-2.5 py-1.5 text-subtext0">
          <Search className="h-3.5 w-3.5" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ACP Registry…" className="w-full bg-transparent text-xs text-text outline-none placeholder:text-subtext0" />
        </label>
        <div className="flex border border-surface1 text-xs">
          {([['all', 'All'], ['installed', 'Installed'], ['not-installed', 'Not Installed']] as const).map(([id, label]) => (
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
          const unavailableReason = entry ? registryUnavailableReason(entry, supportedBinaryTarget) : undefined;
          const installable = !isCustom && !unavailableReason;
          return (
            <article key={`${isCustom ? 'custom' : 'registry'}-${item.id}`} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => installed ? openDetails(installed, entry) : setError(installable ? 'Install this agent first to configure or send a prompt.' : unavailableReason || 'No compatible registry package.')} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2 text-sm font-medium"><AgentIcon icon={entry?.icon} /> <span className="truncate">{name}</span>{version && <span className="text-xs text-subtext0">v{version}</span>}{installed && <span className="border border-green/40 px-1.5 py-0.5 text-[10px] text-green">Installed</span>}</span>
                  <span className="mt-1 block truncate text-[11px] text-subtext0">{description}</span>
                </button>
                {installed ? <button type="button" onClick={() => openDetails(installed, entry)} className="shrink-0 border border-surface2 px-3 py-1.5 text-xs hover:bg-surface0">Manage</button>
                  : installable ? <button type="button" disabled={busyId === item.id || !isTauri()} onClick={() => void install(entry!)} className="shrink-0 border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs text-brand hover:bg-brand/15 disabled:opacity-45">{busyId === item.id ? 'Installing…' : 'Install'}</button>
                    : <span title={unavailableReason} className="shrink-0 max-w-48 text-right text-[10px] text-subtext0">{unavailableReason}</span>}
              </div>
              {entry && <AcpRegistryProjectInfo entry={entry} distribution={registryDistribution(entry)} />}
            </article>
          );
        })}
      </div>
      <p className="text-[11px] text-subtext0">Installing an <code className="font-mono">npx</code> or <code className="font-mono">uvx</code> agent saves its launch config; the package downloads on first launch. Native packages for {supportedBinaryTarget || 'this platform'} are downloaded and extracted into Stage0’s local data folder. Uninstalling removes the launch config; downloaded package files may remain.</p>

      {detailAgent && <Modal title={detailAgent.name} onClose={() => { setDetailAgent(null); setDetailRegistryEntry(null); }}>
          <div className="space-y-4">
          {error && <p role="status" className="border border-yellow/40 bg-yellow/5 px-3 py-2 text-xs text-yellow">{error}</p>}
          {notice && <p role="status" className="border border-green/40 bg-green/5 px-3 py-2 text-xs text-green">{notice}</p>}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm font-semibold">{detailAgent.name}{detailAgent.version ? ` · ${detailAgent.version}` : ''}</p><p className="mt-1 text-xs text-subtext0">{detailAgent.description || 'Custom ACP agent'} · {detailAgent.launchMode === 'binary' ? `Native binary · ${detailAgent.command}` : `${detailAgent.command} ${detailAgent.args.join(' ')}`}</p></div>
            <button type="button" onClick={() => setRemovePending(true)} className="flex items-center gap-1.5 border border-red/40 px-2.5 py-1.5 text-xs text-red hover:bg-red/10"><Trash2 className="h-3.5 w-3.5" /> Uninstall</button>
          </div>
          {detailRegistryEntry ? <section className="space-y-3 border border-surface1 bg-base/40 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold">ACP Registry project information</h3>
              <span className="text-[10px] text-subtext0">Registry metadata · {detailRegistryEntry.version}</span>
            </div>
            <div className="grid gap-x-4 gap-y-2 text-[11px] sm:grid-cols-[110px_minmax(0,1fr)]">
              <span className="text-subtext0">Project ID</span><code className="break-all">{detailRegistryEntry.id}</code>
              <span className="text-subtext0">License</span><span>{detailRegistryEntry.license || 'Not provided'}{projectLicenseUrl && <> · <a href={projectLicenseUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">License details <ExternalLink className="inline h-3 w-3" /></a></>}</span>
              <span className="text-subtext0">Distribution</span><code className="break-all">{registryDistribution(detailRegistryEntry)}</code>
              <span className="text-subtext0">Installed launch</span><code className="break-all">{detailAgent.command} {detailAgent.args.join(' ')}</code>
              {reportedAgentInfo && <><span className="text-subtext0">Agent-reported runtime</span><span>{[reportedAgentInfo.title || reportedAgentInfo.name, reportedAgentInfo.version].filter(Boolean).join(' · ') || 'Name/version not provided'}</span></>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              {detailRegistryEntry.website && (projectWebsiteUrl
                ? <a href={projectWebsiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">Project website <ExternalLink className="h-3 w-3" /></a>
                : <span className="break-all text-subtext0">Website listed: {detailRegistryEntry.website}</span>)}
              {detailRegistryEntry.repository && (projectRepositoryUrl
                ? <a href={projectRepositoryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">Source repository <ExternalLink className="h-3 w-3" /></a>
                : <span className="break-all text-subtext0">Repository listed: {detailRegistryEntry.repository}</span>)}
              {!detailRegistryEntry.website && !detailRegistryEntry.repository && <span className="text-subtext0">No website or source repository was published in this Registry entry.</span>}
            </div>
            <p className="text-[10px] text-subtext0">This is the project information and launch configuration Stage0 received from the ACP Registry; it is not an independent security or publisher verification.</p>
          </section> : <section className="space-y-2 border border-surface1 bg-base/40 p-3">
            <h3 className="text-xs font-semibold">Custom agent configuration</h3>
            <p className="break-all text-[11px] text-subtext0">Launch command: <code>{detailAgent.command} {detailAgent.args.join(' ')}</code></p>
            {reportedAgentInfo && <p className="text-[11px] text-subtext0">Agent-reported runtime: {[reportedAgentInfo.title || reportedAgentInfo.name, reportedAgentInfo.version].filter(Boolean).join(' · ')}</p>}
          </section>}
          {removePending && <div className="flex flex-wrap items-center justify-between gap-2 border border-red/40 bg-red/5 p-3 text-xs"><span>Uninstall this launch config from Stage0? Its package cache may remain on this computer.</span><div className="flex gap-2"><button type="button" onClick={() => setRemovePending(false)} className="border border-surface2 px-2.5 py-1.5">Keep</button><button type="button" onClick={removeAgent} className="border border-red/50 px-2.5 py-1.5 text-red">Uninstall</button></div></div>}
          <section className="space-y-2 border-t border-surface1 pt-4">
            <h3 className="text-xs font-semibold">Account & sign-in</h3>
            <p className="text-[11px] text-subtext0">Stage0 checks the agent automatically when this window opens. Account details come only from the agent; Stage0 never reads or stores its credentials.</p>
            <div role="status" aria-live="polite" className={`border px-3 py-2 text-xs ${authStatus?.kind === 'none' ? 'border-yellow/40 bg-yellow/5 text-yellow' : authStatus ? 'border-green/40 bg-green/5 text-green' : 'border-surface1 bg-base/40 text-subtext0'}`}>
              {isCheckingAuth ? 'Checking account and sign-in methods…' : authStatus ? <div className="space-y-0.5">
                <p className="font-medium">{authStatus.kind === 'none' ? 'Not signed in' : authStatus.label}</p>
                {authStatus.account?.email && <p>{authStatus.account.email}</p>}
                {authStatus.account?.organization && <p>Organization: {authStatus.account.organization}</p>}
                {authStatus.account?.plan && <p>Plan: {authStatus.account.plan}</p>}
                {authStatus.detail && <p>{authStatus.detail}</p>}
              </div> : supportsAuthStatus
                ? 'This agent supports account status reporting but has not reported an account yet.'
                : 'Account status is not reported by this agent over ACP; Stage0 cannot determine whether it is signed in.'}
            </div>
            {authMethods.length ? <div className="flex flex-wrap items-center gap-2">
              <CustomSelect
                value={selectedAuthMethod}
                onChange={setSelectedAuthMethod}
                options={authMethods.map((method) => ({
                  value: method.id,
                  label: `${method.name || method.id}${method.type === 'terminal' ? ' · Interactive terminal' : ''}`,
                  description: method.description,
                }))}
                className="min-w-40"
                buttonClassName="min-w-40"
                dropdownWidth="w-64"
                align="left"
                aria-label="ACP sign-in method"
              />
              <button type="button" disabled={busyId === detailAgent.id || !isTauri() || !isProtocolAuthMethod(selectedAuthOption)} onClick={() => void signIn()} className="border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs text-brand disabled:opacity-50">{busyId === detailAgent.id ? 'Connecting…' : authStatus && authStatus.kind !== 'none' ? 'Change account' : 'Connect account'}</button>
            </div> : !isCheckingAuth && <p className="text-[11px] text-subtext0">This agent did not advertise an ACP sign-in method. If it already has a local session, you can still try sending a prompt.</p>}
            {selectedAuthOption?.type === 'terminal' && <p className="text-[11px] text-yellow">This agent requires interactive terminal sign-in, which Stage0 does not support yet.</p>}
            {selectedAuthOption?.type && selectedAuthOption.type !== 'agent' && selectedAuthOption.type !== 'terminal' && <p className="text-[11px] text-yellow">This sign-in method requires a client-specific setup ({selectedAuthOption.type}); Stage0 cannot complete it automatically.</p>}
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
