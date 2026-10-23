import { invoke, isTauri } from '@tauri-apps/api/core';
import React, { useEffect, useMemo, useState } from 'react';
import { useGitStore } from '../../git/store/useGitStore';
import { useAiMcpStore } from '../store/useAiMcpStore';
import type { AcpAgentConfig, AcpRegistryAgent } from '../types/AcpAgentConfig';
import type { AcpRegistryResponse } from '../types/AcpRegistryResponse';
import type { AuthMethod } from '../types/AuthMethod';
import type { ExternalAgentsFilter as Filter } from '../types/ExternalAgentsFilter';
import type { ExternalAgentsTabProps } from '../types/ExternalAgentsTabProps';
import { forgetAgentSignIn, getLastSuccessfulSignIn } from '../utils/acpAuthHistory';
import { registryUnavailableReason } from '../utils/acpRegistryAvailability';
import { registryDistribution, safeProjectUrl } from '../utils/acpRegistryMetadata';
import { AcpAgentCard } from './external-agents/AcpAgentCard';
import { AcpAgentDetails } from './external-agents/AcpAgentDetails';
import { AcpAgentModalForm } from './external-agents/AcpAgentModalForm';
import { AcpRegistryActions } from './external-agents/AcpRegistryActions';
import { AcpRegistryToolbar } from './external-agents/AcpRegistryToolbar';
import { useAcpAgentAccount } from './useAcpAgentAccount';
import { useAcpAgentPrompt } from './useAcpAgentPrompt';
import { useCustomAcpAgentForm } from './useCustomAcpAgentForm';

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
  const account = useAcpAgentAccount({ setError, detailAgent, setBusyId, setNotice });

  const promptSession = useAcpAgentPrompt({ detailAgent, setError, currentRepoPath });

  const [removePending, setRemovePending] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const customForm = useCustomAcpAgentForm({
    setError,
    updateExternalAgents,
    externalAgents,
    setIsCustomOpen,
  });

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
    account.setAuthMethods([]);
    account.setAuthStatus(null);
    account.setSupportsAuthStatus(false);
    account.setReportedAgentInfo(null);
    account.setSelectedAuthMethod('');
    account.setLastSuccessfulSignIn(getLastSuccessfulSignIn(agent));
    promptSession.setPrompt('What can you help me with?');
    promptSession.setResponse('');
    setRemovePending(false);
    setError(null);
    setNotice(null);
    account.setIsCheckingAuth(isTauri());
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
          project={{
            detailAgent: detailAgent,
            detailRegistryEntry: detailRegistryEntry,
            projectLicenseUrl: projectLicenseUrl,
            registryDistribution: registryDistribution,
            reportedAgentInfo: account.reportedAgentInfo,
            projectWebsiteUrl: projectWebsiteUrl,
            projectRepositoryUrl: projectRepositoryUrl,
          }}
          dialog={{
            setDetailAgent: setDetailAgent,
            setDetailRegistryEntry: setDetailRegistryEntry,
            error: error,
            notice: notice,
            setRemovePending: setRemovePending,
            removePending: removePending,
            removeAgent: removeAgent,
          }}
          account={{
            authStatus: account.authStatus,
            lastSuccessfulSignIn: account.lastSuccessfulSignIn,
            isCheckingAuth: account.isCheckingAuth,
            supportsAuthStatus: account.supportsAuthStatus,
            authMethods: account.authMethods,
            selectedAuthMethod: account.selectedAuthMethod,
            setSelectedAuthMethod: account.setSelectedAuthMethod,
            busyId: busyId,
            isProtocolAuthMethod: isProtocolAuthMethod,
            selectedAuthOption: account.selectedAuthOption,
            signIn: account.signIn,
          }}
          promptSession={{
            currentRepoPath: currentRepoPath,
            prompt: promptSession.prompt,
            setPrompt: promptSession.setPrompt,
            isSendingPrompt: promptSession.isSendingPrompt,
            sendPrompt: promptSession.sendPrompt,
            response: promptSession.response,
          }}
        />
      )}

      {isCustomOpen && (
        <AcpAgentModalForm
          setIsCustomOpen={setIsCustomOpen}
          addCustomAgent={customForm.addCustomAgent}
          error={error}
          customName={customForm.customName}
          setCustomName={customForm.setCustomName}
          customCommand={customForm.customCommand}
          setCustomCommand={customForm.setCustomCommand}
          customArgs={customForm.customArgs}
          setCustomArgs={customForm.setCustomArgs}
        />
      )}
    </div>
  );
};
