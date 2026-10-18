import type { McpServerConfig } from '../types/McpServerConfig';

// Runtime claims cannot be imported, restored from disk or supplied by a preset.
export function resetMcpVerification(server: McpServerConfig): McpServerConfig {
  return {
    ...server,
    testStatus: 'untested',
    testMessage: undefined,
    lastTestedAt: undefined,
    toolsCount: undefined,
    resourcesCount: undefined,
  };
}
