import type { AcpRegistryAgent } from '../types/AcpAgentConfig';

export type AcpRegistryUnavailableReason =
  | { kind: 'platformInfoUnavailable' }
  | { kind: 'noPublisherPackage'; target: string }
  | { kind: 'invalidLaunchMetadata' }
  | { kind: 'unsafeLaunchPath' }
  | { kind: 'windowsExecutableRequired' }
  | { kind: 'secureDownloadRequired' }
  | { kind: 'unsupportedArchive' }
  | { kind: 'invalidDownloadUrl' };

export function registryUnavailableReason(
  agent: AcpRegistryAgent,
  target?: string
): AcpRegistryUnavailableReason | undefined {
  if (agent.distribution.npx || agent.distribution.uvx) return undefined;
  if (!target) return { kind: 'platformInfoUnavailable' };
  const binary = agent.distribution.binary?.[target];
  if (!binary || typeof binary !== 'object') return { kind: 'noPublisherPackage', target };
  const { archive, cmd } = binary as Record<string, unknown>;
  if (typeof archive !== 'string' || typeof cmd !== 'string' || !cmd.trim()) return { kind: 'invalidLaunchMetadata' };
  const path = cmd.replaceAll('\\', '/');
  const parts = path.split('/').filter((part) => part && part !== '.');
  if (!parts.length || path.startsWith('/') || parts.some((part) => part === '..' || part.includes(':') || /[. ]$/.test(part) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(part)) || /[\x00-\x1f\x7f]/.test(path)) return { kind: 'unsafeLaunchPath' };
  if (target.startsWith('windows-') && !path.toLowerCase().endsWith('.exe')) return { kind: 'windowsExecutableRequired' };
  try {
    const url = new URL(archive);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return { kind: 'secureDownloadRequired' };
    if (/\.(dmg|pkg|deb|rpm|msi|appimage|tar|xz|7z|rar)$/i.test(url.pathname)) return { kind: 'unsupportedArchive' };
    return undefined;
  } catch {
    return { kind: 'invalidDownloadUrl' };
  }
}
