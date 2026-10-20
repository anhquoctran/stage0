import type { AcpRegistryAgent } from '../types/AcpAgentConfig';

export function registryUnavailableReason(agent: AcpRegistryAgent, target?: string): string | undefined {
  if (agent.distribution.npx || agent.distribution.uvx) return undefined;
  if (!target) return 'Platform information is unavailable. Refresh the registry.';
  const binary = agent.distribution.binary?.[target];
  if (!binary || typeof binary !== 'object') return `No publisher package for ${target}`;
  const { archive, cmd } = binary as Record<string, unknown>;
  if (typeof archive !== 'string' || typeof cmd !== 'string' || !cmd.trim()) return 'The registry package has invalid launch metadata.';
  const path = cmd.replaceAll('\\', '/');
  const parts = path.split('/').filter((part) => part && part !== '.');
  if (!parts.length || path.startsWith('/') || parts.some((part) => part === '..' || part.includes(':') || /[. ]$/.test(part) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(part)) || /[\x00-\x1f\x7f]/.test(path)) return 'The registry package has an unsafe launch path.';
  if (target.startsWith('windows-') && !path.toLowerCase().endsWith('.exe')) return 'The Windows package must provide an .exe executable.';
  try {
    const url = new URL(archive);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) return 'The registry package must use a secure HTTPS download.';
    if (/\.(dmg|pkg|deb|rpm|msi|appimage|tar|xz|7z|rar)$/i.test(url.pathname)) return 'The registry package uses an unsupported archive or installer format.';
    return undefined;
  } catch {
    return 'The registry package has an invalid download URL.';
  }
}
