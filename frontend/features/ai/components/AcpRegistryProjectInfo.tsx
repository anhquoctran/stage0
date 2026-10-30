import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from '../../../common/components/icons/ExternalLink';
import { openUrl } from '../../../common/utils/openUrl';
import type { AcpRegistryProjectInfoProps } from '../types/AcpRegistryProjectInfoProps';

function safeProjectUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export const AcpRegistryProjectInfo: React.FC<AcpRegistryProjectInfoProps> = ({ entry, distribution }) => {
  const { t } = useTranslation();
  const websiteUrl = safeProjectUrl(entry.website);
  const repositoryUrl = safeProjectUrl(entry.repository);
  const licenseUrl = safeProjectUrl(entry.licenseUrl);

  const handleLinkClick = (url: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    void openUrl(url);
  };

  return (
    <details className="ms-6 mt-1 max-w-3xl text-[10px] text-subtext0">
      <summary className="w-fit cursor-pointer select-none hover:text-text focus-visible:outline focus-visible:outline-brand">
        {t('ai.acpRegistry.projectInformation')} <span className="text-subtext0">· {t('ai.acpRegistry.metadata')}</span>
      </summary>
      <div className="mt-2 grid gap-x-3 gap-y-1 border-s border-surface1 ps-3 sm:grid-cols-[90px_minmax(0,1fr)] rounded-sm">
        <span>{t('ai.acpRegistry.projectId')}</span><code className="break-all text-text">{entry.id}</code>
        <span>{t('ai.acpRegistry.version')}</span><span className="text-text">{entry.version || t('ai.acpRegistry.notProvided')}</span>
        <span>{t('ai.acpRegistry.license')}</span><span className="text-text">{entry.license || t('ai.acpRegistry.notProvided')}{licenseUrl && <> · <a href={licenseUrl} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick(licenseUrl)} className="text-brand hover:underline cursor-pointer">{t('ai.acpRegistry.details')} <ExternalLink className="inline h-3 w-3" /></a></>}</span>
        <span>{t('ai.acpRegistry.distribution')}</span><code className="break-all text-text">{distribution}</code>
        {entry.website && <><span>{t('ai.acpRegistry.website')}</span>{websiteUrl ? <a href={websiteUrl} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick(websiteUrl)} className="break-all text-brand hover:underline cursor-pointer">{entry.website} <ExternalLink className="inline h-3 w-3" /></a> : <span className="break-all text-text">{entry.website}</span>}</>}
        {entry.repository && <><span>{t('ai.acpRegistry.source')}</span>{repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick(repositoryUrl)} className="break-all text-brand hover:underline cursor-pointer">{entry.repository} <ExternalLink className="inline h-3 w-3" /></a> : <span className="break-all text-text">{entry.repository}</span>}</>}
      </div>
    </details>
  );
};
