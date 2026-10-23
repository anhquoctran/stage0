import React from 'react';
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
  const websiteUrl = safeProjectUrl(entry.website);
  const repositoryUrl = safeProjectUrl(entry.repository);
  const licenseUrl = safeProjectUrl(entry.licenseUrl);

  const handleLinkClick = (url: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    void openUrl(url);
  };

  return (
    <details className="ml-6 mt-1 max-w-3xl text-[10px] text-subtext0">
      <summary className="w-fit cursor-pointer select-none hover:text-text focus-visible:outline focus-visible:outline-brand">
        Project information <span className="text-subtext0">· Registry metadata</span>
      </summary>
      <div className="mt-2 grid gap-x-3 gap-y-1 border-l border-surface1 pl-3 sm:grid-cols-[90px_minmax(0,1fr)] rounded-sm">
        <span>Project ID</span><code className="break-all text-text">{entry.id}</code>
        <span>Version</span><span className="text-text">{entry.version || 'Not provided'}</span>
        <span>License</span><span className="text-text">{entry.license || 'Not provided'}{licenseUrl && <> · <a href={licenseUrl} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick(licenseUrl)} className="text-brand hover:underline cursor-pointer">Details <ExternalLink className="inline h-3 w-3" /></a></>}</span>
        <span>Distribution</span><code className="break-all text-text">{distribution}</code>
        {entry.website && <><span>Website</span>{websiteUrl ? <a href={websiteUrl} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick(websiteUrl)} className="break-all text-brand hover:underline cursor-pointer">{entry.website} <ExternalLink className="inline h-3 w-3" /></a> : <span className="break-all text-text">{entry.website}</span>}</>}
        {entry.repository && <><span>Source</span>{repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noopener noreferrer" onClick={handleLinkClick(repositoryUrl)} className="break-all text-brand hover:underline cursor-pointer">{entry.repository} <ExternalLink className="inline h-3 w-3" /></a> : <span className="break-all text-text">{entry.repository}</span>}</>}
      </div>
    </details>
  );
};
