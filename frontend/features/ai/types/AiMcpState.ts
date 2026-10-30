import { type AiConfig } from './AiConfig';
import { type AiModelPreset } from './AiModelPreset';
import { type McpServerConfig } from './McpServerConfig';
import { type GuardrailMode } from './GuardrailMode';
import { type GuardrailPolicy } from './GuardrailPolicy';
import { type GuardrailAuditEvent } from './GuardrailAuditEvent';
import { type GuardrailEvaluationResult } from './GuardrailEvaluationResult';
import type { AcpAgentConfig } from './AcpAgentConfig';

export interface AiMcpState {
  aiConfig: AiConfig;
  apiKeysConfigured: Partial<Record<AiConfig['provider'], boolean>>;
  isCheckingApiKey: boolean;
  apiKeyCheckError: string | null;
  mcpServers: McpServerConfig[];
  isTestingAi: boolean;
  aiTestResult: { success: boolean; message: string; timestamp: number } | null;
  activeSubTab: 'ai' | 'mcp' | 'guardrails' | 'prompts';
  setActiveSubTab: (tab: 'ai' | 'mcp' | 'guardrails' | 'prompts') => void;

  // Dynamic Live Models State
  dynamicModels: Record<string, AiModelPreset[]>;
  isFetchingDynamicModels: boolean;
  dynamicModelError: string | null;
  fetchDynamicModels: (configOverride?: AiConfig) => Promise<{
    success: boolean;
    count: number;
    error?: string;
    models?: AiModelPreset[];
  }>;

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
  externalAgents: AcpAgentConfig[];
  updateExternalAgents: (agents: AcpAgentConfig[]) => void;
  guardrailAuditLog: GuardrailAuditEvent[];
  isGuardrailLoading: boolean;
  loadGuardrailPolicy: () => Promise<void>;
  updateGuardrailPolicy: (partial: Partial<GuardrailPolicy>) => Promise<void>;
  resetGuardrailPolicy: (mode: GuardrailMode) => Promise<void>;
  loadGuardrailAuditLog: (limit?: number) => Promise<void>;
  clearGuardrailAuditLog: () => Promise<void>;
  simulateGuardrailCheck: (toolName: string, args: Record<string, unknown>) => Promise<GuardrailEvaluationResult>;
}
