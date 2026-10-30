import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AgentIcon } from '../AgentIcon';
import { ONBOARDING_ACP_PROVIDERS } from '../../constants/onboardingAcpProviders';
import type { AcpRegistryAgent } from '../../types/AcpAgentConfig';
import { registryUnavailableReason } from '../../utils/acpRegistryAvailability';
import type { AcpOnboardingProviderPickerProps } from './AcpOnboardingProviderPickerProps';

export function AcpOnboardingProviderPicker({
  registry,
  externalAgents,
  supportedBinaryTarget,
  busyId,
  isLoading,
  canLaunchAgents,
  onInstall,
  onManage,
}: AcpOnboardingProviderPickerProps) {
  const { t } = useTranslation();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const findEntry = (agentId: string) => registry.find((entry) => entry.id === agentId);
  const findInstalled = (agentId: string) =>
    externalAgents.find((agent) => agent.id === agentId && agent.source === 'registry');
  const getReason = (entry?: AcpRegistryAgent) => {
    if (entry) return registryUnavailableReason(entry, supportedBinaryTarget);
    return isLoading ? t('ai.externalAgents.loadingProvider') : t('ai.externalAgents.providerUnavailable');
  };

  const renderAgentAction = (agentId: string, compact = false) => {
    const entry = findEntry(agentId);
    const installed = findInstalled(agentId);
    const unavailable = getReason(entry);
    const isBusy = busyId === agentId;
    const disabled = !canLaunchAgents || !entry || !!unavailable || isBusy;
    const label = entry?.name ?? agentId;
    return (
      <button
        key={agentId}
        type="button"
        disabled={disabled}
        aria-label={t(installed ? 'ai.externalAgents.manageProvider' : 'ai.externalAgents.installProvider', { name: label })}
        onClick={() => {
          if (!entry) return;
          if (installed) onManage(installed, entry);
          else onInstall(entry);
        }}
        title={unavailable ?? undefined}
        className={`flex items-center justify-between gap-2 rounded-sm border border-surface1 bg-base text-start text-text transition-colors hover:bg-surface1 disabled:cursor-not-allowed disabled:opacity-50 ${compact ? 'min-h-10 px-2 py-1.5 text-[11px]' : 'min-h-24 flex-col px-3 py-3 text-xs font-semibold'}`}
      >
        <span className={`flex min-w-0 items-center gap-2 ${compact ? '' : 'flex-col'}`}>
          <AgentIcon icon={entry?.icon} className={compact ? 'h-4 w-4' : 'h-8 w-8'} />
          <span className="truncate">{label}</span>
        </span>
        <span className={`shrink-0 text-[10px] ${installed ? 'text-brand' : 'text-subtext0'}`}>
          {isBusy
            ? t('ai.externalAgents.installing')
            : installed
              ? t('ai.externalAgents.manage')
              : unavailable
                ? isLoading
                  ? t('common.loading')
                  : t('ai.externalAgents.unavailable')
                : t('ai.externalAgents.install')}
        </span>
      </button>
    );
  };

  return (
    <section aria-label={t('ai.externalAgents.popularProviders')} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {ONBOARDING_ACP_PROVIDERS.map((provider) => {
        if (provider.agentIds.length === 1) return renderAgentAction(provider.agentIds[0]);
        const expanded = expandedGroup === provider.id;
        const icons = provider.agentIds.map(findEntry);
        return (
          <div key={provider.id} className="space-y-2 rounded-sm">
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={`${provider.name}: ${t(expanded ? 'ai.externalAgents.hideProviderChoices' : 'ai.externalAgents.chooseProvider')}`}
              onClick={() => setExpandedGroup(expanded ? null : provider.id)}
              className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-sm border border-surface1 bg-base px-3 py-3 text-xs font-semibold text-text transition-colors hover:bg-surface1"
            >
              <span className="flex items-center gap-2">
                {icons.map((entry, index) => (
                  <AgentIcon
                    key={provider.agentIds[index]}
                    icon={entry?.icon}
                    className="h-8 w-8"
                  />
                ))}
              </span>
              <span>{provider.name}</span>
              <span className="text-[10px] font-normal text-subtext0">{t('ai.externalAgents.chooseCursorOrXai')}</span>
            </button>
            {expanded && (
              <div className="grid grid-cols-1 gap-1.5">
                {provider.agentIds.map((agentId) => renderAgentAction(agentId, true))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
