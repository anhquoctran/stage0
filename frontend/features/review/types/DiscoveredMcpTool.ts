export interface DiscoveredMcpTool {
  name: string;
  namespacedName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnlyHint: boolean | null;
}
