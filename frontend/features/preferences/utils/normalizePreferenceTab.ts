import { SETTINGS_TREE } from '../constants/settingsTree';
import type { PreferenceTab } from '../types/PreferenceTab';

// Helper to normalize legacy tab strings
export const normalizeTab = (tab?: string): PreferenceTab => {
  if (!tab) return 'ai-overview';
  switch (tab) {
    case 'about':
    case 'general':
      return 'general-settings';
    case 'guardrails':
      return 'ai-guardrails';
    case 'appearance':
      return 'appearance-theme';
    case 'fonts':
      return 'appearance-fonts';
    case 'markdown-font':
    case 'markdown':
      return 'appearance-markdown-font';
    case 'editor':
      return 'editor-diff';
    case 'ai':
      return 'ai-overview';
    case 'mcp':
      return 'ai-mcp';
    case 'reviewers':
      return 'ai-reviewers';
    case 'sandbox':
      return 'ai-sandbox';
    case 'git':
      return 'git-binary';
    case 'credentials':
      return 'git-credentials';
    case 'notifications':
    case 'notifications-settings':
      return 'notifications-settings';
    default:
      return SETTINGS_TREE.some((category) => category.children.some((child) => child.id === tab))
        ? (tab as PreferenceTab)
        : 'ai-overview';
  }
};
