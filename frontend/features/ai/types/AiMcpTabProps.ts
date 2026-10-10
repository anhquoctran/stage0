import { type AiConfig } from './AiConfig';

export interface AiMcpTabProps {
  draftAiConfig?: AiConfig;
  onUpdateAiConfig?: (partial: Partial<AiConfig>) => void;
  onNavigateToGuardrails?: () => void;
  activeView?: 'providers' | 'mcp' | 'prompts';
  onBackToOverview?: () => void;
}
