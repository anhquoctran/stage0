import { AI_PROVIDERS } from '../../ai/constants/aiPresets';
import { providerSettingsFor } from '../../ai/utils/aiProviderSettings';
import type { AiMcpState } from '../../ai/types/AiMcpState';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';

/** Saved setup only; never reads credentials, launches an agent or claims inference works. */
export function onboardingAiConnections(state: Pick<AiMcpState, 'aiConfig' | 'apiKeysConfigured' | 'externalAgents'>): string[] {
  const { aiConfig, apiKeysConfigured, externalAgents } = state;
  const providers = AI_PROVIDERS.filter((provider) => {
    if (!aiConfig.configuredProviders?.includes(provider.id)) return false;
    const settings = providerSettingsFor(aiConfig, provider.id);
    if (!settings.model.trim()) return false;
    try {
      const endpoint = new URL(settings.baseUrl);
      if (!['http:', 'https:'].includes(endpoint.protocol) || !endpoint.hostname) return false;
    } catch { return false; }
    return !provider.requiresApiKey || apiKeysConfigured[provider.id] === true;
  }).map((provider) => provider.name);
  const agents = externalAgents.filter((agent) => agent.id.trim() && agent.name.trim() && agent.command.trim() &&
    Array.isArray(agent.args) && agent.args.every((arg) => typeof arg === 'string')).map((agent) => `${agent.name} (ACP)`);
  return [...providers, ...agents];
}

export function hasRequiredOnboardingReviewer(reviewers: BotReviewer[]): boolean {
  return reviewers.some((reviewer) => !reviewer.isBuiltin && reviewer.enabled && reviewer.name.trim().length > 0);
}
