import { ExternalLink } from '../../../../common/components/icons/ExternalLink';
import type { AcpAgentDetailsProps } from './AcpAgentDetailsProps';

export function AcpAgentProjectInfo({
  project: {
    detailAgent,
    detailRegistryEntry,
    projectLicenseUrl,
    registryDistribution,
    reportedAgentInfo,
    projectWebsiteUrl,
    projectRepositoryUrl,
  },
}: Pick<AcpAgentDetailsProps, 'project'>) {
  return (
    <>
      {detailRegistryEntry ? (
        <section className="space-y-3 border border-surface1 bg-base/40 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold">ACP Registry project information</h3>
            <span className="text-[10px] text-subtext0">
              Registry metadata · {detailRegistryEntry.version}
            </span>
          </div>
          <div className="grid gap-x-4 gap-y-2 text-[11px] sm:grid-cols-[110px_minmax(0,1fr)]">
            <span className="text-subtext0">Project ID</span>
            <code className="break-all">{detailRegistryEntry.id}</code>
            <span className="text-subtext0">License</span>
            <span>
              {detailRegistryEntry.license || 'Not provided'}
              {projectLicenseUrl && (
                <>
                  {' '}
                  ·{' '}
                  <a
                    href={projectLicenseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline"
                  >
                    License details <ExternalLink className="inline h-3 w-3" />
                  </a>
                </>
              )}
            </span>
            <span className="text-subtext0">Distribution</span>
            <code className="break-all">{registryDistribution(detailRegistryEntry)}</code>
            <span className="text-subtext0">Installed launch</span>
            <code className="break-all">
              {detailAgent.command} {detailAgent.args.join(' ')}
            </code>
            {reportedAgentInfo && (
              <>
                <span className="text-subtext0">Agent-reported runtime</span>
                <span>
                  {[reportedAgentInfo.title || reportedAgentInfo.name, reportedAgentInfo.version]
                    .filter(Boolean)
                    .join(' · ') || 'Name/version not provided'}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            {detailRegistryEntry.website &&
              (projectWebsiteUrl ? (
                <a
                  href={projectWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  Project website <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="break-all text-subtext0">
                  Website listed: {detailRegistryEntry.website}
                </span>
              ))}
            {detailRegistryEntry.repository &&
              (projectRepositoryUrl ? (
                <a
                  href={projectRepositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand hover:underline"
                >
                  Source repository <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="break-all text-subtext0">
                  Repository listed: {detailRegistryEntry.repository}
                </span>
              ))}
            {!detailRegistryEntry.website && !detailRegistryEntry.repository && (
              <span className="text-subtext0">
                No website or source repository was published in this Registry entry.
              </span>
            )}
          </div>
          <p className="text-[10px] text-subtext0">
            This is the project information and launch configuration Stage0 received from the ACP
            Registry; it is not an independent security or publisher verification.
          </p>
        </section>
      ) : (
        <section className="space-y-2 border border-surface1 bg-base/40 p-3">
          <h3 className="text-xs font-semibold">Custom agent configuration</h3>
          <p className="break-all text-[11px] text-subtext0">
            Launch command:{' '}
            <code>
              {detailAgent.command} {detailAgent.args.join(' ')}
            </code>
          </p>
          {reportedAgentInfo && (
            <p className="text-[11px] text-subtext0">
              Agent-reported runtime:{' '}
              {[reportedAgentInfo.title || reportedAgentInfo.name, reportedAgentInfo.version]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </section>
      )}
    </>
  );
}
