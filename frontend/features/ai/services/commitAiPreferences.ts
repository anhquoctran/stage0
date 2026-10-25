import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

import { useAiMcpStore } from '../store/useAiMcpStore';
import { useBotReviewersStore } from '../store/useBotReviewersStore';
import type { AiPreferencesEditor } from '../types/AiPreferencesEditor';
import type { AiPreferencesSnapshot } from '../types/AiPreferencesSnapshot';
import type { AiProviderId } from '../types/AiProviderId';
import { cleanAiSnapshot, mergeAiPreferences } from '../utils/aiPreferencesSnapshot';
import { isLikelySecretMcpEnvValue, isSecretMcpEnvName } from '../utils/listSecretMcpEnv';
import { preferencesJsonService } from '../../preferences/services/preferencesJsonService';

export function captureAiPreferences(): AiPreferencesSnapshot {
  const { aiConfig, mcpServers, guardrailPolicy, externalAgents } = useAiMcpStore.getState();
  return cleanAiSnapshot({ aiConfig, mcpServers, guardrailPolicy, globalReviewers: useBotReviewersStore.getState().globalReviewers, externalAgents });
}

let committing = false;
export async function commitAiPreferences(
  draft: AiPreferencesEditor,
  baseline: AiPreferencesSnapshot,
  additionalPreferences: Record<string, unknown> = {},
): Promise<AiPreferencesSnapshot> {
  if (committing) throw new Error('An AI preferences save is already in progress.');
  committing = true;
  let previous: Awaited<ReturnType<typeof preferencesJsonService.load>> | null = null;
  let committed: Awaited<ReturnType<typeof preferencesJsonService.patch>> | null = null;
  try {
    const snapshot = mergeAiPreferences(draft, baseline, captureAiPreferences());
    const apiKeys = Object.fromEntries(Object.entries(draft.apiKeyDrafts).filter(([, key]) => key?.trim()).map(([provider, key]) => [provider, key!.trim()]));
    const apiKeyRemovals = draft.apiKeyRemovals.filter((provider) => !(provider in apiKeys));
    const currentMcpServers = captureAiPreferences().mcpServers;
    const mcpEnvSecrets: Record<string, Record<string, string>> = {};
    const persistedMcpServers = snapshot.mcpServers.map((server) => {
      const env = { ...(server.env ?? {}) };
      const secretEnvKeys = new Set(server.secretEnvKeys ?? []);
      for (const [name, value] of Object.entries(env)) {
        if (secretEnvKeys.has(name) || isSecretMcpEnvName(name) || isLikelySecretMcpEnvValue(value)) {
          secretEnvKeys.add(name);
          if (value.trim()) {
            mcpEnvSecrets[server.id] ??= {};
            mcpEnvSecrets[server.id][name] = value.trim();
          }
          delete env[name];
        }
      }
      return { ...server, env, secretEnvKeys: [...secretEnvKeys].sort() };
    });
    const nextSecretNames = new Map(persistedMcpServers.map((server) => [server.id, new Set(server.secretEnvKeys ?? [])]));
    const mcpEnvRemovals: Record<string, string[]> = {};
    for (const server of currentMcpServers) {
      const nextNames = nextSecretNames.get(server.id) ?? new Set<string>();
      const removed = (server.secretEnvKeys ?? []).filter((name) => !nextNames.has(name));
      if (removed.length) mcpEnvRemovals[server.id] = removed;
    }
    if (!getApplicationServices().platform.capabilities.keychain && (Object.keys(apiKeys).length || apiKeyRemovals.length || Object.keys(mcpEnvSecrets).length || Object.keys(mcpEnvRemovals).length)) {
      throw new Error('Saving credentials requires the native Stage0 app and OS keychain. The draft is preserved.');
    }
    previous = await preferencesJsonService.load();
    const persistedAiConfig = { ...snapshot.aiConfig } as Record<string, unknown>;
    delete persistedAiConfig.apiKey;
    const previousAi = previous.settings?.ai;
    const previousAiConfig = previousAi && typeof previousAi === 'object' && !Array.isArray(previousAi)
      ? (previousAi as Record<string, unknown>).aiConfig
      : undefined;
    const previousAiConfigFields = previousAiConfig && typeof previousAiConfig === 'object' && !Array.isArray(previousAiConfig)
      ? previousAiConfig as Record<string, unknown>
      : undefined;
    for (const key of ['authMode', 'cliType']) {
      if (previousAiConfigFields && Object.prototype.hasOwnProperty.call(previousAiConfigFields, key)) {
        persistedAiConfig[key] = { $stage0Delete: true };
      } else {
        delete persistedAiConfig[key];
      }
    }
    // One JSONC patch commits AI plus the dialog's other app preferences and reviewers.
    // Runtime Zustand state is published only after the keyring batch also succeeds.
    committed = await preferencesJsonService.patch({
      ...additionalPreferences,
      ai: { aiConfig: persistedAiConfig, mcpServers: persistedMcpServers, guardrailPolicy: snapshot.guardrailPolicy, externalAgents: snapshot.externalAgents },
      reviewers: snapshot.globalReviewers,
    });
    let configured: Partial<Record<AiProviderId, boolean>> = {};
    if (getApplicationServices().platform.capabilities.keychain && (Object.keys(apiKeys).length || apiKeyRemovals.length || Object.keys(mcpEnvSecrets).length || Object.keys(mcpEnvRemovals).length)) {
      configured = await getApplicationServices().aiProviders.commitAiPreferences({
        apiKeys,
        apiKeyRemovals,
        policy: null,
        mcpEnvSecrets,
        mcpEnvRemovals,
      });
    }
    const committedSnapshot = cleanAiSnapshot({ ...snapshot, mcpServers: persistedMcpServers });
    useAiMcpStore.setState((state) => ({ aiConfig: snapshot.aiConfig, mcpServers: persistedMcpServers, guardrailPolicy: snapshot.guardrailPolicy,
      externalAgents: snapshot.externalAgents,
      apiKeysConfigured: { ...state.apiKeysConfigured, ...configured }, aiTestResult: null }));
    useBotReviewersStore.setState({ globalReviewers: snapshot.globalReviewers });
    return committedSnapshot;
  } catch (error) {
    if (previous && committed) {
      try { await preferencesJsonService.saveText(previous.content, committed.revision); }
      catch { throw new Error('Preferences save failed and file rollback was incomplete. Keep this dialog open and check preferences.json before retrying.'); }
    }
    throw error;
  } finally { committing = false; }
}
