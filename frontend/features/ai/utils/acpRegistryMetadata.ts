import type { AcpRegistryAgent } from '../types/AcpAgentConfig';

export function safeProjectUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function registryDistribution(entry: AcpRegistryAgent): string {
  for (const manager of ['npx', 'uvx']) {
    const config = entry.distribution[manager];
    if (!config || typeof config !== 'object' || Array.isArray(config)) continue;
    const details = config as Record<string, unknown>;
    const packageName = typeof details.package === 'string' ? details.package : undefined;
    if (!packageName) continue;
    const args = Array.isArray(details.args)
      ? details.args.filter((arg): arg is string => typeof arg === 'string').join(' ')
      : '';
    return `${manager} ${packageName}${args ? ` ${args}` : ''}`;
  }

  const binaries = entry.distribution.binary;
  if (binaries && typeof binaries === 'object' && !Array.isArray(binaries)) {
    const targets = Object.entries(binaries as Record<string, unknown>).map(([target, value]) => {
      const command =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>).cmd
          : undefined;
      return typeof command === 'string' ? `${target} · ${command}` : target;
    });
    if (targets.length) return targets.join(', ');
  }

  return Object.keys(entry.distribution).join(', ') || 'Not specified';
}
