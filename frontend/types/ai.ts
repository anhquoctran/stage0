export type AiProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';

export interface AiModelPreset {
  id: string;
  name: string;
  recommendedFor?: string;
}

export interface AiProviderPreset {
  id: AiProviderId;
  name: string;
  description: string;
  defaultBaseUrl: string;
  defaultModel: string;
  models: AiModelPreset[];
  requiresApiKey: boolean;
  docUrl: string;
}

export interface AiConfig {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  streamResponse: boolean;
  enableCodeReviewAssist: boolean;
}

export type McpServerType = 'stdio' | 'sse';

export interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  type: McpServerType;
  command: string; // for stdio (e.g. npx, uvx, python)
  args: string[]; // arguments
  env: Record<string, string>; // environment variables
  url?: string; // for sse
  cwd?: string; // working directory
  enabled: boolean;
  toolsCount?: number;
  resourcesCount?: number;
  lastTestedAt?: string;
  testStatus?: 'success' | 'failed' | 'untested';
}

export interface McpConfigFileFormat {
  mcpServers: Record<
    string,
    {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
    }
  >;
}
