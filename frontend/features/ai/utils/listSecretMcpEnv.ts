import type { McpServerConfig } from '../types/McpServerConfig';

export function listSecretMcpEnv(servers: McpServerConfig[]): string[] {
  return servers.flatMap((server) => Object.entries(server.env ?? {})
    .filter(([name, value]) => value.trim() && (
      isSecretMcpEnvName(name) || isLikelySecretMcpEnvValue(value)
    ))
    .map(([name]) => `${server.name}: ${name}`));
}

export function publicMcpEnv(env: Record<string, string>, secretEnvKeys: string[] = []): Record<string, string> {
  const secretNames = new Set(secretEnvKeys);
  return Object.fromEntries(Object.entries(env).filter(([name, value]) =>
    !secretNames.has(name) && !isSecretMcpEnvName(name) && !isLikelySecretMcpEnvValue(value)
  ));
}

export function isSecretMcpEnvName(name: string): boolean {
  return /(token|secret|password|credential|key)/i.test(name);
}

export function isLikelySecretMcpEnvValue(value: string): boolean {
  return /^(sk-|ghp_|github_pat_|glpat-|xox[bp]-)/i.test(value.trim());
}
