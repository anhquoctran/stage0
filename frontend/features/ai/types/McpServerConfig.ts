import type { McpServerType } from './McpServerType';

export interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  type: McpServerType;
  command: string; // for stdio (e.g. npx, uvx, python)
  args: string[]; // arguments
  env: Record<string, string>; // environment variables
  url?: string; // Streamable HTTP or legacy SSE endpoint; never embed credentials
  cwd?: string; // working directory
  enabled: boolean;
  toolsCount?: number;
  resourcesCount?: number;
  lastTestedAt?: string;
  testStatus?: 'success' | 'failed' | 'untested' | 'unavailable';
  testMessage?: string;
}
