import { invoke, isTauri } from '@tauri-apps/api/core';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { useBotReviewersStore } from '../store/useBotReviewersStore';
import type { AiPreferencesEditor } from '../types/AiPreferencesEditor';
import type { AiPreferencesSnapshot } from '../types/AiPreferencesSnapshot';
import type { AiProviderId } from '../types/AiProviderId';
import { cleanAiSnapshot, mergeAiPreferences } from '../utils/aiPreferencesSnapshot';

export function captureAiPreferences(): AiPreferencesSnapshot {
  const { aiConfig, mcpServers, guardrailPolicy } = useAiMcpStore.getState();
  return cleanAiSnapshot({ aiConfig, mcpServers, guardrailPolicy, globalReviewers: useBotReviewersStore.getState().globalReviewers });
}

let committing = false;
export async function commitAiPreferences(draft: AiPreferencesEditor, baseline: AiPreferencesSnapshot): Promise<AiPreferencesSnapshot> {
  if (committing) throw new Error('An AI preferences save is already in progress.');
  committing = true;
  const previous = new Map<string, string | null>();
  try {
    const snapshot = mergeAiPreferences(draft, baseline, captureAiPreferences());
    const apiKeys = Object.fromEntries(Object.entries(draft.apiKeyDrafts).filter(([, key]) => key?.trim()).map(([provider, key]) => [provider, key!.trim()]));
    const policyChanged = JSON.stringify(snapshot.guardrailPolicy) !== JSON.stringify(useAiMcpStore.getState().guardrailPolicy);
    if (!isTauri() && Object.keys(apiKeys).length) throw new Error('Saving API keys requires the native Stage0 app and OS keyring.');
    const records = [
      ['stage0_ai_mcp_config', JSON.stringify({ aiConfig: snapshot.aiConfig, mcpServers: snapshot.mcpServers, guardrailPolicy: snapshot.guardrailPolicy })],
      ['stage0_global_bot_reviewers', JSON.stringify(snapshot.globalReviewers)],
    ];
    // Stage durable, secret-free settings before native writes. On error restore the old records;
    // publish no committed Zustand state until the awaited native batch has succeeded.
    for (const [key, value] of records) { previous.set(key, localStorage.getItem(key)); localStorage.setItem(key, value); }
    let configured: Partial<Record<AiProviderId, boolean>> = {};
    if (isTauri() && (policyChanged || Object.keys(apiKeys).length)) {
      configured = await invoke('commit_ai_preferences', { apiKeys, policy: policyChanged ? snapshot.guardrailPolicy : null });
    }
    useAiMcpStore.setState((state) => ({ aiConfig: snapshot.aiConfig, mcpServers: snapshot.mcpServers, guardrailPolicy: snapshot.guardrailPolicy,
      apiKeysConfigured: { ...state.apiKeysConfigured, ...configured }, aiTestResult: null }));
    useBotReviewersStore.setState({ globalReviewers: snapshot.globalReviewers });
    return snapshot;
  } catch (error) {
    let restored = true;
    for (const [key, value] of previous) {
      try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { restored = false; }
    }
    if (!restored) throw new Error('Preferences save failed and local storage rollback was incomplete. Keep this dialog open and check storage availability.');
    throw error;
  } finally { committing = false; }
}
