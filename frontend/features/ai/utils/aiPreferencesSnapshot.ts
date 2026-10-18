import type { AiPreferencesSnapshot } from '../types/AiPreferencesSnapshot';
import type { AiPreferencesEditor } from '../types/AiPreferencesEditor';
import { resetMcpVerification } from './resetMcpVerification';

export function cleanAiSnapshot(snapshot: AiPreferencesSnapshot): AiPreferencesSnapshot {
  return structuredClone({ aiConfig: { ...snapshot.aiConfig, apiKey: '' }, mcpServers: snapshot.mcpServers.map(resetMcpVerification), guardrailPolicy: snapshot.guardrailPolicy, globalReviewers: snapshot.globalReviewers });
}
export function aiPreferencesChangeCount(draft: AiPreferencesEditor, baseline: AiPreferencesSnapshot): number {
  const current = cleanAiSnapshot(draft); const saved = cleanAiSnapshot(baseline);
  // Project explicitly: editor contains methods and temporary secret drafts, never persistence data.
  let count = Object.keys({ ...saved.aiConfig, ...current.aiConfig }).filter((key) => {
    const field = key as keyof AiPreferencesSnapshot['aiConfig'];
    return current.aiConfig[field] !== saved.aiConfig[field];
  }).length;
  for (const key of ['mcpServers', 'guardrailPolicy', 'globalReviewers'] as const) if (JSON.stringify(current[key]) !== JSON.stringify(saved[key])) count++;
  count += Object.values(draft.apiKeyDrafts).filter((key) => key?.trim()).length;
  return count;
}

export function mergeAiPreferences(draft: AiPreferencesSnapshot, baseline: AiPreferencesSnapshot, latest: AiPreferencesSnapshot): AiPreferencesSnapshot {
  const result = cleanAiSnapshot(latest); const current = cleanAiSnapshot(draft); const previous = cleanAiSnapshot(baseline);
  for (const key of Object.keys({ ...previous.aiConfig, ...current.aiConfig }) as Array<keyof AiPreferencesSnapshot['aiConfig']>) {
    if (current.aiConfig[key] === previous.aiConfig[key]) continue;
    if (latest.aiConfig[key] !== previous.aiConfig[key] && latest.aiConfig[key] !== current.aiConfig[key]) throw new Error('AI configuration changed outside this dialog. Cancel and reopen Preferences before retrying.');
    Object.assign(result.aiConfig, { [key]: current.aiConfig[key] });
  }
  for (const key of ['mcpServers', 'guardrailPolicy', 'globalReviewers'] as const) {
    if (JSON.stringify(current[key]) === JSON.stringify(previous[key])) continue;
    if (JSON.stringify(latest[key]) !== JSON.stringify(previous[key]) && JSON.stringify(latest[key]) !== JSON.stringify(current[key])) throw new Error('AI preferences changed outside this dialog. Cancel and reopen Preferences before retrying.');
    Object.assign(result, { [key]: current[key] });
  }
  return result;
}
