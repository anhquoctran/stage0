import React from 'react';
import { ExternalLink } from '../../../common/components/icons/ExternalLink';
import { openUrl } from '../../../common/utils/openUrl';

export const AcpRegistryAbout: React.FC = () => {
  const handleLinkClick = (url: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    void openUrl(url);
  };

  return (
    <details className="relative text-[11px] text-subtext0">
      <summary className="cursor-pointer select-none font-medium text-subtext0 hover:text-text focus-visible:outline focus-visible:outline-brand">
        About ACP &amp; its Registry
      </summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <p><span className="font-medium text-text">ACP</span> is an open protocol that standardizes communication between code editors and coding agents. Stage0 uses it to connect to compatible local agents.</p>
        <p><span className="font-medium text-text">ACP Registry</span> is a curated catalog of compatible agents. The project details below come from its feed; Stage0 displays them but does not independently verify publishers or package safety.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 sm:col-span-2">
          <a
            href="https://agentclientprotocol.com/get-started/introduction"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick('https://agentclientprotocol.com/get-started/introduction')}
            className="inline-flex items-center gap-1 text-brand hover:underline cursor-pointer"
          >
            ACP overview <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://agentclientprotocol.com/get-started/registry"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick('https://agentclientprotocol.com/get-started/registry')}
            className="inline-flex items-center gap-1 text-brand hover:underline cursor-pointer"
          >
            Registry documentation <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href="https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLinkClick('https://cdn.agentclientprotocol.com/registry/v1/latest/registry.json')}
            className="inline-flex items-center gap-1 text-brand hover:underline cursor-pointer"
          >
            Registry feed <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </details>
  );
};
