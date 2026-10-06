export type AiProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'xai_grok'
  | 'github_copilot'
  | 'ollama'
  | 'custom';

export type AiAuthMode = 'api_key' | 'subscription_oauth' | 'cli_bridge';

export interface DynamicModelInfo {
  id: string;
  name: string;
  description?: string;
}

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
  supportedAuthModes?: AiAuthMode[];
}

export interface AiConfig {
  provider: AiProviderId;
  authMode?: AiAuthMode;
  cliType?: 'claude' | 'gh_copilot' | 'gcloud' | 'grok';
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  streamResponse: boolean;
  enableCodeReviewAssist: boolean;
}

export interface CliDetectionResult {
  cli_type: string;
  available: boolean;
  version?: string;
  logged_in: boolean;
  auth_info?: string;
  executable_path?: string;
  error?: string;
}

export interface CopilotDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface CopilotAuthStatus {
  connected: boolean;
  username?: string;
  avatar_url?: string;
  has_subscription: boolean;
  expires_at?: number;
  error?: string;
}

export interface GoogleAuthStatus {
  connected: boolean;
  account_email?: string;
  auth_method: string;
  error?: string;
}

export interface ChatGptAuthStatus {
  connected: boolean;
  account_email?: string;
  error?: string;
}

export interface UnifiedAiChatResponse {
  success: boolean;
  content: string;
  duration_ms: number;
  provider_used: string;
  error?: string;
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
