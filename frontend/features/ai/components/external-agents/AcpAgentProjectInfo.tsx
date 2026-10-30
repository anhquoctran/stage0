import { ExternalLink } from '../../../../common/components/icons/ExternalLink';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <>
      {detailRegistryEntry ? (
        <section className="space-y-3 border border-surface1 bg-base/40 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold">{t('ai.acpRegistry.projectInformation')}</h3>
            <span className="text-[10px] text-subtext0">
              {t('ai.acpRegistry.metadata')} · {detailRegistryEntry.version}
            </span>
          </div>
          <div className="grid gap-x-4 gap-y-2 text-[11px] sm:grid-cols-[110px_minmax(0,1fr)]">
            <span className="text-subtext0">{t('ai.acpRegistry.projectId')}</span>
            <code className="break-all">{detailRegistryEntry.id}</code>
            <span className="text-subtext0">{t('ai.acpRegistry.license')}</span>
            <span>
              {detailRegistryEntry.license || t('ai.acpRegistry.notProvided')}
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
                    {t('ai.externalAgents.licenseDetails')} <ExternalLink className="inline h-3 w-3" />
                  </a>
                </>
              )}
            </span>
            <span className="text-subtext0">{t('ai.acpRegistry.distribution')}</span>
            <code className="break-all">{registryDistribution(detailRegistryEntry)}</code>
            <span className="text-subtext0">{t('ai.externalAgents.installedLaunch')}</span>
            <code className="break-all">
              {detailAgent.command} {detailAgent.args.join(' ')}
            </code>
            {reportedAgentInfo && (
              <>
                <span className="text-subtext0">{t('ai.externalAgents.reportedRuntime')}</span>
                <span>
                  {[reportedAgentInfo.title || reportedAgentInfo.name, reportedAgentInfo.version]
                    .filter(Boolean)
                    .join(' · ') || t('ai.externalAgents.nameVersionMissing')}
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
                  {t('ai.externalAgents.projectWebsite')} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="break-all text-subtext0">
                  {t('ai.externalAgents.websiteListed', { url: detailRegistryEntry.website })}
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
                  {t('ai.externalAgents.sourceRepository')} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="break-all text-subtext0">
                  {t('ai.externalAgents.repositoryListed', { url: detailRegistryEntry.repository })}
                </span>
              ))}
            {!detailRegistryEntry.website && !detailRegistryEntry.repository && (
              <span className="text-subtext0">
                {t('ai.externalAgents.noProjectLinks')}
              </span>
            )}
          </div>
          <p className="text-[10px] text-subtext0">
            {t('ai.externalAgents.registryTrustNotice')}
          </p>
        </section>
      ) : (
        <section className="space-y-2 border border-surface1 bg-base/40 p-3">
          <h3 className="text-xs font-semibold">{t('ai.externalAgents.customAgentConfiguration')}</h3>
          <p className="break-all text-[11px] text-subtext0">
            {t('ai.externalAgents.launchCommand')}{' '}
            <code>
              {detailAgent.command} {detailAgent.args.join(' ')}
            </code>
          </p>
          {reportedAgentInfo && (
            <p className="text-[11px] text-subtext0">
              {t('ai.externalAgents.reportedRuntime')}{' '}
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
