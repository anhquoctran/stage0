import { isTauri } from '@tauri-apps/api/core';
import { AcpRegistryProjectInfo } from '../AcpRegistryProjectInfo';
import { AgentIcon } from '../AgentIcon';
import type { AcpAgentCardProps } from './AcpAgentCardProps';

export function AcpAgentCard({
  isCustom,
  item,
  installed,
  openDetails,
  entry,
  setError,
  installable,
  unavailableReason,
  name,
  version,
  description,
  busyId,
  install,
  registryDistribution,
}: AcpAgentCardProps) {
  return (
    <article key={`${isCustom ? 'custom' : 'registry'}-${item.id}`} className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            installed
              ? openDetails(installed, entry)
              : setError(
                  installable
                    ? 'Install this agent first to configure or send a prompt.'
                    : unavailableReason || 'No compatible registry package.'
                )
          }
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <AgentIcon icon={entry?.icon} /> <span className="truncate">{name}</span>
            {version && <span className="text-xs text-subtext0">v{version}</span>}
            {installed && (
              <span className="border border-green/40 px-1.5 py-0.5 text-[10px] text-green">
                Installed
              </span>
            )}
          </span>
          <span className="mt-1 block truncate text-[11px] text-subtext0">{description}</span>
        </button>
        {installed ? (
          <button
            type="button"
            onClick={() => openDetails(installed, entry)}
            className="shrink-0 border border-surface2 px-3 py-1.5 text-xs hover:bg-surface0"
          >
            Manage
          </button>
        ) : installable ? (
          <button
            type="button"
            disabled={busyId === item.id || !isTauri()}
            onClick={() => void install(entry!)}
            className="shrink-0 border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs text-brand hover:bg-brand/15 disabled:opacity-45"
          >
            {busyId === item.id ? 'Installing…' : 'Install'}
          </button>
        ) : (
          <span
            title={unavailableReason}
            className="shrink-0 max-w-48 text-right text-[10px] text-subtext0"
          >
            {unavailableReason}
          </span>
        )}
      </div>
      {entry && <AcpRegistryProjectInfo entry={entry} distribution={registryDistribution(entry)} />}
    </article>
  );
}
