import { useEffect, useRef, useState } from 'react';
import { useAiMcpStore } from '../../ai/store/useAiMcpStore';
import { createAiPreferencesDraft } from '../../ai/store/createAiPreferencesDraft';
import { captureAiPreferences, commitAiPreferences } from '../../ai/services/commitAiPreferences';
import { aiPreferencesChangeCount } from '../../ai/utils/aiPreferencesSnapshot';
import { onboardingAiConnections } from '../services/onboardingAiStatus';

export function useOnboardingAiSetup() {
  const committed = useAiMcpStore();
  const [baseline, setBaseline] = useState(captureAiPreferences);
  const [draftStore] = useState(() => createAiPreferencesDraft(baseline));
  const draft = draftStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acting = useRef(false);
  const connections = onboardingAiConnections(committed);
  const hasChanges = aiPreferencesChangeCount(draft, baseline) > 0;
  const canFinish = () => !acting.current && aiPreferencesChangeCount(draftStore.getState(), baseline) === 0 &&
    onboardingAiConnections(useAiMcpStore.getState()).length > 0;

  useEffect(() => () => draftStore.getState().replace(captureAiPreferences()), [draftStore]);

  const save = async () => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true); setError(null);
    try {
      const saved = await commitAiPreferences(draftStore.getState(), baseline);
      setBaseline(saved);
      draftStore.getState().replace(saved);
    } catch (cause) {
      setError(`Could not save AI setup: ${cause instanceof Error ? cause.message : String(cause)} Your draft is still available.`);
    } finally { acting.current = false; setBusy(false); }
  };
  const discard = () => {
    if (acting.current) return;
    const latest = captureAiPreferences();
    setBaseline(latest); draftStore.getState().replace(latest); setError(null);
  };
  const checkSavedKeys = async () => {
    if (acting.current) return;
    acting.current = true; setBusy(true); setError(null);
    try {
      const state = useAiMcpStore.getState();
      for (const provider of state.aiConfig.configuredProviders ?? []) {
        if (provider === 'ollama' || useAiMcpStore.getState().apiKeysConfigured[provider]) continue;
        await state.loadApiKeyForProvider(provider);
        const failure = useAiMcpStore.getState().apiKeyCheckError;
        if (failure) throw new Error(failure);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { acting.current = false; setBusy(false); }
  };
  return { draft, connections, busy, error, hasChanges, canFinish, save, discard, checkSavedKeys };
}
