import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Bot } from '../../../common/components/icons/Bot';

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

export function AgentIcon({ icon }: { icon?: string }) {
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
