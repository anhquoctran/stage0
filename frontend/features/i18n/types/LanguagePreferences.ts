import type { AppLanguage } from './AppLanguage';
import type { AgentOutputLanguage } from './AgentOutputLanguage';

export interface LanguagePreferences {
  uiLanguage: AppLanguage;
  agentOutputLanguage: AgentOutputLanguage;
}
