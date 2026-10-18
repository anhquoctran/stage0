import { type AiConfig } from './AiConfig';
import type { AiPreferencesEditor } from './AiPreferencesEditor';

export interface AiMcpTabProps {
  draftSettings?: AiPreferencesEditor;
  draftAiConfig?: AiConfig;
  onUpdateAiConfig?: (partial: Partial<AiConfig>) => void;
  onNavigateToGuardrails?: () => void;
  activeView?: 'providers' | 'mcp' | 'prompts';
  onBackToOverview?: () => void;
}
