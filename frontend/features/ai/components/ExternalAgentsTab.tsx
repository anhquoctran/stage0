import { invoke, isTauri } from '@tauri-apps/api/core';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGitStore } from '../../git/store/useGitStore';
import { useAiMcpStore } from '../store/useAiMcpStore';
import type { AcpAgentConfig, AcpRegistryAgent } from '../types/AcpAgentConfig';
import type { AcpAgentConnectionInfo } from '../types/AcpAgentConnectionInfo';
import type { AcpRegistryResponse } from '../types/AcpRegistryResponse';
import type { AuthMethod } from '../types/AuthMethod';
import type { ExternalAgentsFilter as Filter } from '../types/ExternalAgentsFilter';
import type { ExternalAgentsTabProps } from '../types/ExternalAgentsTabProps';
import {
  forgetAgentSignIn,
  getLastSuccessfulSignIn,
  saveLastSuccessfulSignIn,
  type AcpLastSuccessfulSignIn,
} from '../utils/acpAuthHistory';
import { registryUnavailableReason } from '../utils/acpRegistryAvailability';
import { registryDistribution, safeProjectUrl } from '../utils/acpRegistryMetadata';
import { AcpAgentCard } from './external-agents/AcpAgentCard';
import { AcpAgentDetails } from './external-agents/AcpAgentDetails';
import { AcpAgentModalForm } from './external-agents/AcpAgentModalForm';
import { AcpRegistryActions } from './external-agents/AcpRegistryActions';
import { AcpRegistryToolbar } from './external-agents/AcpRegistryToolbar';

function isProtocolAuthMethod(method?: AuthMethod): boolean {
  return !method?.type || method.type === 'agent';
}

export const ExternalAgentsTab: React.FC<ExternalAgentsTabProps> = ({
  draftSettings,
  onBackToOverview,
} = {}) => {
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
  const [reportedAgentInfo, setReportedAgentInfo] =
    useState<AcpAgentConnectionInfo['agentInfo']>(null);
  const [selectedAuthMethod, setSelectedAuthMethod] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const [lastSuccessfulSignIn, setLastSuccessfulSignIn] = useState<AcpLastSuccessfulSignIn | null>(
    null
  );
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
      .then((result) => {
        if (!cancelled) {
          setRegistry(result.agents);
          setSupportedBinaryTarget(result.supportedBinaryTarget ?? undefined);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(String(cause));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyConnectionInfo = useCallback((info: AcpAgentConnectionInfo) => {
    setAuthMethods(info.authMethods);
    setSelectedAuthMethod(info.authMethods[0]?.id || '');
    setAuthStatus(info.authStatus);
    setSupportsAuthStatus(info.supportsAuthStatus);
    setReportedAgentInfo(info.agentInfo);
  }, []);

  const refreshAgentConnection = useCallback(
    async (agent: AcpAgentConfig): Promise<AcpAgentConnectionInfo | null> => {
      const requestId = ++connectionRequestRef.current;
      setIsCheckingAuth(true);
      setError(null);
      try {
        const info = await invoke<AcpAgentConnectionInfo>('acp_agent_connection_info', {
          config: agent,
        });
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
    },
    [applyConnectionInfo]
  );

  useEffect(() => {
    if (!detailAgent) return;
    setAuthMethods([]);
    setAuthStatus(null);
    setSupportsAuthStatus(false);
    setReportedAgentInfo(null);
    if (isTauri()) void refreshAgentConnection(detailAgent);
    return () => {
      connectionRequestRef.current += 1;
    };
  }, [detailAgent, refreshAgentConnection]);

  const visibleAgents = useMemo(() => {
    const search = query.trim().toLowerCase();
    const installedIds = new Set(externalAgents.map((agent) => agent.id));
    const entries = registry.filter((agent) => {
      const installed = installedIds.has(agent.id);
      if (filter === 'installed' && !installed) return false;
      if (filter === 'not-installed' && installed) return false;
      return (
        !search || `${agent.name} ${agent.id} ${agent.description}`.toLowerCase().includes(search)
      );
    });
    if (filter === 'not-installed') return entries;
    const custom = externalAgents.filter(
      (agent) =>
        agent.source === 'custom' &&
        (!search || `${agent.name} ${agent.id} ${agent.command}`.toLowerCase().includes(search))
    );
    return [...custom, ...entries];
  }, [registry, externalAgents, filter, query]);

  const install = async (entry: AcpRegistryAgent) => {
    setBusyId(entry.id);
    setError(null);
    try {
      const config = await invoke<AcpAgentConfig>('acp_prepare_registry_agent', {
        agentId: entry.id,
      });
      updateExternalAgents([...externalAgents.filter((agent) => agent.id !== config.id), config]);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusyId(null);
    }
  };

  const openDetails = (agent: AcpAgentConfig, entry?: AcpRegistryAgent) => {
    setDetailAgent(agent);
    setDetailRegistryEntry(entry ?? null);
    setAuthMethods([]);
    setAuthStatus(null);
    setSupportsAuthStatus(false);
    setReportedAgentInfo(null);
    setSelectedAuthMethod('');
    setLastSuccessfulSignIn(getLastSuccessfulSignIn(agent));
    setPrompt('What can you help me with?');
    setResponse('');
    setRemovePending(false);
    setError(null);
    setNotice(null);
    setIsCheckingAuth(isTauri());
  };

  const signIn = async () => {
    if (!detailAgent || !selectedAuthMethod) return;
    setBusyId(detailAgent.id);
    setError(null);
    try {
      const method = authMethods.find((item) => item.id === selectedAuthMethod);
      const isGoogleSignIn = /google/i.test(
        `${method?.name || ''} ${method?.id || selectedAuthMethod}`
      );
      setNotice(
        isGoogleSignIn
          ? 'Starting Google sign-in. Antigravity should open your default browser if a new login is needed…'
          : 'Starting the agent sign-in flow…'
      );
      const result = await invoke<{ authStatus: AcpAgentConnectionInfo['authStatus'] }>(
        'acp_agent_authenticate',
        { config: detailAgent, methodId: selectedAuthMethod }
      );
      const completed: AcpLastSuccessfulSignIn = {
        completedAt: new Date().toISOString(),
        methodId: selectedAuthMethod,
        methodLabel: method?.name || selectedAuthMethod,
        agentVersion: detailAgent.version,
      };
      setLastSuccessfulSignIn(completed);
      const saved = saveLastSuccessfulSignIn(detailAgent, completed);
      setNotice('Sign-in completed. Refreshing the agent-reported account status…');
      const refreshed = await refreshAgentConnection(detailAgent);
      const reportedStatus = refreshed?.authStatus ?? result?.authStatus ?? null;
      if (reportedStatus) setAuthStatus(reportedStatus);
      setNotice(
        reportedStatus
          ? 'Sign-in completed. The account details shown here are reported by the agent.'
          : saved
            ? 'Sign-in completed. This agent does not provide account details over ACP; Stage0 saved the sign-in result on this device.'
            : 'Sign-in completed, but Stage0 could not save the local sign-in confirmation. This agent does not provide account details over ACP.'
      );
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusyId(null);
    }
  };

  const sendPrompt = async () => {
    if (!detailAgent || !prompt.trim()) return;
    setIsSendingPrompt(true);
    setError(null);
    setResponse('');
    try {
      const result = await invoke<string>('acp_agent_prompt', {
        config: detailAgent,
        prompt,
        cwd: currentRepoPath,
      });
      setResponse(result);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setIsSendingPrompt(false);
    }
  };

  const addCustomAgent = (event: React.FormEvent) => {
    event.preventDefault();
    if (!customName.trim() || !customCommand.trim()) {
      setError('Name and command are required.');
      return;
    }
    const config: AcpAgentConfig = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      source: 'custom',
      command: customCommand.trim(),
      args: customArgs
        .split(/\r?\n/)
        .map((arg) => arg.trim())
        .filter(Boolean),
    };
    updateExternalAgents([...externalAgents, config]);
    setCustomName('');
    setCustomCommand('');
    setCustomArgs('');
    setIsCustomOpen(false);
    setError(null);
  };

  const removeAgent = () => {
    if (!detailAgent) return;
    forgetAgentSignIn(detailAgent.id);
    updateExternalAgents(externalAgents.filter((agent) => agent.id !== detailAgent.id));
    setDetailAgent(null);
    setDetailRegistryEntry(null);
    setRemovePending(false);
  };

  const registryConfig = (entry: AcpRegistryAgent) =>
    externalAgents.find((agent) => agent.id === entry.id);
  const selectedAuthOption = authMethods.find((method) => method.id === selectedAuthMethod);
  const projectWebsiteUrl = safeProjectUrl(detailRegistryEntry?.website);
  const projectRepositoryUrl = safeProjectUrl(detailRegistryEntry?.repository);
  const projectLicenseUrl = safeProjectUrl(detailRegistryEntry?.licenseUrl);

  return (
    <div className="space-y-2 text-text">
      <AcpRegistryActions
        onBackToOverview={onBackToOverview}
        setIsCustomOpen={setIsCustomOpen}
        isLoading={isLoading}
        setError={setError}
        setIsLoading={setIsLoading}
        setRegistry={setRegistry}
        setSupportedBinaryTarget={setSupportedBinaryTarget}
        String={String}
      />

      {error && (
        <p
          role="status"
          className="border border-yellow/40 bg-yellow/5 px-3 py-2 text-xs text-yellow"
        >
          {error}
        </p>
      )}
      {!isTauri() && (
        <p className="border border-surface1 px-3 py-2 text-xs text-subtext0">
          ACP agents need the Stage0 desktop app to launch a local agent process.
        </p>
      )}

      <AcpRegistryToolbar query={query} setQuery={setQuery} setFilter={setFilter} filter={filter} />

      <div className="divide-y divide-surface1 border-y border-surface1">
        {isLoading && !registry.length && (
          <p className="px-3 py-8 text-center text-xs text-subtext0">Loading ACP Registry…</p>
        )}
        {!isLoading && !visibleAgents.length && (
          <p className="px-3 py-8 text-center text-xs text-subtext0">No agents match this view.</p>
        )}
        {visibleAgents.map((item) => {
          const isCustom = 'source' in item && item.source === 'custom';
          const entry = isCustom ? undefined : (item as AcpRegistryAgent);
          const installed = isCustom
            ? (item as AcpAgentConfig)
            : registryConfig(item as AcpRegistryAgent);
          const name = isCustom ? (item as AcpAgentConfig).name : (item as AcpRegistryAgent).name;
          const version = isCustom ? undefined : (item as AcpRegistryAgent).version;
          const description = isCustom
            ? (item as AcpAgentConfig).command
            : (item as AcpRegistryAgent).description;
          const unavailableReason = entry
            ? registryUnavailableReason(entry, supportedBinaryTarget)
            : undefined;
          const installable = !isCustom && !unavailableReason;
          return (
            <AcpAgentCard
              key={`${isCustom ? 'custom' : 'registry'}-${item.id}`}
              isCustom={isCustom}
              item={item}
              installed={installed}
              openDetails={openDetails}
              entry={entry}
              setError={setError}
              installable={installable}
              unavailableReason={unavailableReason}
              name={name}
              version={version}
              description={description}
              busyId={busyId}
              install={install}
              registryDistribution={registryDistribution}
            />
          );
        })}
      </div>
      <p className="text-[11px] text-subtext0">
        Installing an <code className="font-mono">npx</code> or{' '}
        <code className="font-mono">uvx</code> agent saves its launch config; the package downloads
        on first launch. Native packages for {supportedBinaryTarget || 'this platform'} are
        downloaded and extracted into Stage0’s local data folder. Uninstalling removes the launch
        config; downloaded package files may remain.
      </p>

      {detailAgent && (
        <AcpAgentDetails
          detailAgent={detailAgent}
          setDetailAgent={setDetailAgent}
          setDetailRegistryEntry={setDetailRegistryEntry}
          error={error}
          notice={notice}
          setRemovePending={setRemovePending}
          detailRegistryEntry={detailRegistryEntry}
          projectLicenseUrl={projectLicenseUrl}
          registryDistribution={registryDistribution}
          reportedAgentInfo={reportedAgentInfo}
          projectWebsiteUrl={projectWebsiteUrl}
          projectRepositoryUrl={projectRepositoryUrl}
          removePending={removePending}
          removeAgent={removeAgent}
          authStatus={authStatus}
          lastSuccessfulSignIn={lastSuccessfulSignIn}
          isCheckingAuth={isCheckingAuth}
          supportsAuthStatus={supportsAuthStatus}
          authMethods={authMethods}
          selectedAuthMethod={selectedAuthMethod}
          setSelectedAuthMethod={setSelectedAuthMethod}
          busyId={busyId}
          isProtocolAuthMethod={isProtocolAuthMethod}
          selectedAuthOption={selectedAuthOption}
          signIn={signIn}
          currentRepoPath={currentRepoPath}
          prompt={prompt}
          setPrompt={setPrompt}
          isSendingPrompt={isSendingPrompt}
          sendPrompt={sendPrompt}
          response={response}
        />
      )}

      {isCustomOpen && (
        <AcpAgentModalForm
          setIsCustomOpen={setIsCustomOpen}
          addCustomAgent={addCustomAgent}
          error={error}
          customName={customName}
          setCustomName={setCustomName}
          customCommand={customCommand}
          setCustomCommand={setCustomCommand}
          customArgs={customArgs}
          setCustomArgs={setCustomArgs}
        />
      )}
    </div>
  );
};
