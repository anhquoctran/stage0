export const ONBOARDING_ACP_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', agentIds: ['codex-acp'] },
  { id: 'claude', name: 'Claude', agentIds: ['claude-acp'] },
  { id: 'antigravity', name: 'Antigravity', agentIds: ['antigravity-acp'] },
  { id: 'cursor-xai', name: 'Cursor / xAI', agentIds: ['cursor', 'grok-build'] },
  { id: 'copilot', name: 'Copilot', agentIds: ['github-copilot-cli'] },
] as const;
