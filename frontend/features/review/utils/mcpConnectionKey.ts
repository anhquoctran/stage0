import type { McpServerConfig } from '../../ai/types/McpServerConfig';

// Match only the inputs actually used by source-free HTTP discovery. No env,
// credentials, repo path or launch arguments enter its IPC or fingerprint.
export function mcpConnectionKey(server: McpServerConfig): string {
  return JSON.stringify([server.id, server.type, server.url || '', server.enabled]);
}
