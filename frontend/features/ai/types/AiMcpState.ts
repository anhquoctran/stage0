import { type AiConfig } from './AiConfig';
import { type AiModelPreset } from './AiModelPreset';
import { type McpServerConfig } from './McpServerConfig';
import { type CliDetectionResult } from './CliDetectionResult';
import { type CopilotDeviceCodeResponse } from './CopilotDeviceCodeResponse';
import { type CopilotAuthStatus } from './CopilotAuthStatus';
import { type GoogleAuthStatus } from './GoogleAuthStatus';
import { type ChatGptAuthStatus } from './ChatGptAuthStatus';
import { type GuardrailMode } from './GuardrailMode';
import { type GuardrailPolicy } from './GuardrailPolicy';
import { type GuardrailAuditEvent } from './GuardrailAuditEvent';
import { type GuardrailEvaluationResult } from './GuardrailEvaluationResult';

export interface AiMcpState {
  aiConfig: AiConfig;
  apiKeysConfigured: Partial<Record<AiConfig['provider'], boolean>>;
  mcpServers: McpServerConfig[];
  isTestingAi: boolean;
  aiTestResult: { success: boolean; message: string; timestamp: number } | null;
  activeSubTab: 'ai' | 'mcp' | 'guardrails' | 'prompts';
  setActiveSubTab: (tab: 'ai' | 'mcp' | 'guardrails' | 'prompts') => void;

  // Dynamic Live Models State
  dynamicModels: Partial<Record<AiConfig['provider'], AiModelPreset[]>>;
  isFetchingDynamicModels: boolean;
  dynamicModelError: string | null;
  fetchDynamicModels: (providerOverride?: AiConfig['provider']) => Promise<{ success: boolean; count: number; error?: string }>;

  // Cloud Subscription & CLI Bridge State
  copilotStatus: CopilotAuthStatus | null;
  googleAuthStatus: GoogleAuthStatus | null;
  chatgptAuthStatus: ChatGptAuthStatus | null;
  cliStatus: Record<string, CliDetectionResult | null>;
  isDetectingCli: boolean;
  isConnectingSubscription: boolean;
  copilotDeviceCode: CopilotDeviceCodeResponse | null;

  // Cloud Subscription & CLI Bridge Actions
  detectCli: (cliType: string) => Promise<CliDetectionResult | null>;
  executeCliTest: (cliType: string, prompt?: string) => Promise<{ success: boolean; output: string }>;
  startCopilotFlow: () => Promise<CopilotDeviceCodeResponse | null>;
  pollCopilotToken: (deviceCode: string) => Promise<{ status: string; error?: string }>;
  checkCopilotStatus: () => Promise<CopilotAuthStatus>;
  disconnectCopilot: () => Promise<void>;
  startGoogleOAuth: () => Promise<void>;
  checkGoogleAuthStatus: () => Promise<GoogleAuthStatus>;
  disconnectGoogleOAuth: () => Promise<void>;
  startChatGptOAuth: () => Promise<void>;
  checkChatGptAuthStatus: () => Promise<ChatGptAuthStatus>;
  disconnectChatGptOAuth: () => Promise<void>;
  clearCopilotDeviceCode: () => void;

  // AI Configuration Actions
  updateAiConfig: (partial: Partial<AiConfig>) => void;
  resetAiConfig: () => void;
  setProvider: (providerId: AiConfig['provider']) => void;
  loadApiKeyForProvider: (providerId: AiConfig['provider']) => Promise<void>;
  testAiConnection: (configOverride?: AiConfig, apiKeyIsPresent?: boolean) => Promise<{ success: boolean; message: string }>;
  clearAiTestResult: () => void;

  // MCP Server Actions
  addMcpServer: (server: Omit<McpServerConfig, 'id'>) => void;
  updateMcpServer: (id: string, server: Partial<McpServerConfig>) => void;
  deleteMcpServer: (id: string) => void;
  toggleMcpServer: (id: string) => void;
  testMcpServer: (id: string) => Promise<{ success: boolean; message: string }>;
  importMcpConfigFile: (jsonStr: string) => { success: boolean; count: number; error?: string };
  exportMcpConfigFile: () => string;

  // AI & MCP Security Guardrails Actions
  guardrailPolicy: GuardrailPolicy;
  guardrailAuditLog: GuardrailAuditEvent[];
  isGuardrailLoading: boolean;
  loadGuardrailPolicy: () => Promise<void>;
  updateGuardrailPolicy: (partial: Partial<GuardrailPolicy>) => Promise<void>;
  resetGuardrailPolicy: (mode: GuardrailMode) => Promise<void>;
  loadGuardrailAuditLog: (limit?: number) => Promise<void>;
  clearGuardrailAuditLog: () => Promise<void>;
  simulateGuardrailCheck: (toolName: string, args: Record<string, unknown>) => Promise<GuardrailEvaluationResult>;
}
