import type { McpServerType } from './McpServerType';

export interface McpConfigFileFormat {
  mcpServers: Record<
    string,
    {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
      type?: McpServerType;
    }
  >;
}
