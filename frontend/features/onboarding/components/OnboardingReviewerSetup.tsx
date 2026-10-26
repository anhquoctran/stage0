import { useState, type FormEvent } from 'react';
import { AI_PROVIDERS } from '../../ai/constants/aiPresets';
import { providerSettingsFor } from '../../ai/utils/aiProviderSettings';
import type { OnboardingReviewerConnection } from '../types/OnboardingReviewerConnection';
import type { OnboardingReviewerSetupProps } from '../types/OnboardingReviewerSetupProps';

export function OnboardingReviewerSetup({ draftSettings, hasSavedRequiredReviewer }: OnboardingReviewerSetupProps) {
  const [name, setName] = useState('Code Reviewer');
  const [connectionId, setConnectionId] = useState('');
  const [consentedAcpAgentId, setConsentedAcpAgentId] = useState<string | null>(null);
  const providerIds = draftSettings.aiConfig.configuredProviders ?? [];
  const providers = AI_PROVIDERS.filter((provider) => providerIds.includes(provider.id)).map((provider) => ({
    id: provider.id,
    value: `provider:${provider.id}`,
    kind: 'provider' as const,
    label: provider.name,
    model: providerSettingsFor(draftSettings.aiConfig, provider.id).model.trim() || 'global_default',
  }));
  const agents = draftSettings.externalAgents
    .filter((agent) => agent.id.trim() && agent.command.trim())
    .map((agent) => ({ id: agent.id, value: `acp:${agent.id}`, kind: 'acp' as const, label: `${agent.name} (ACP)`, agent }));
  const connections: OnboardingReviewerConnection[] = [...providers, ...agents];
  const activeProvider = providers.find((provider) => provider.id === draftSettings.aiConfig.provider);
  const selected = connections.find((connection) => connection.value === connectionId) ?? activeProvider ?? connections[0];
  const readyReviewer = draftSettings.globalReviewers.find(
    (reviewer) => !reviewer.isBuiltin && reviewer.enabled && reviewer.name.trim()
  );

  const createReviewer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || (selected.kind === 'acp' && consentedAcpAgentId !== selected.id)) return;
    draftSettings.addGlobalReviewer({
      name: name.trim(),
      tagline: 'Code review',
      description: 'Checks code changes for correctness, reliability, and maintainability.',
      category: 'custom',
      avatarEmoji: '🤖',
      customInstructions: '',
      ...(selected.kind === 'provider'
        ? { provider: selected.id, model: selected.model }
        : { acpAgentId: selected.id, allowAcpSourceTransfer: true }),
      temperature: 0.2,
      enabled: true,
      isBuiltin: false,
    });
  };

  if (readyReviewer) {
    return <div role="status" className="space-y-1 rounded-sm bg-surface0 p-3 text-xs leading-5 text-subtext1">
      <p className="font-semibold text-text">{readyReviewer.name} is ready.</p>
      <p>{hasSavedRequiredReviewer ? 'Your first reviewer is saved.' : 'Select Save AI setup below to save your reviewer.'}</p>
    </div>;
  }

  return <form onSubmit={createReviewer} className="space-y-3 rounded-sm border border-surface0 p-3">
    <p className="text-xs leading-5 text-subtext0">Start with a general code reviewer. You can fine-tune its role and instructions later in AI Preferences.</p>
    <label className="block space-y-1 text-xs font-medium text-subtext1">
      Reviewer name
      <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80}
        className="w-full rounded-sm border border-surface1 bg-base px-3 py-2 text-sm text-text" />
    </label>
    {connections.length > 1 ? <label className="block space-y-1 text-xs font-medium text-subtext1">
      AI connection
      <select value={selected?.value ?? ''} onChange={(event) => setConnectionId(event.target.value)}
        className="w-full rounded-sm border border-surface1 bg-base px-3 py-2 text-sm text-text">
        {connections.map((connection) => <option key={connection.value} value={connection.value}>{connection.label}</option>)}
      </select>
    </label> : selected && <p className="text-xs text-subtext0">Uses {selected.label}.</p>}
    {!selected ? <p role="status" className="text-xs text-subtext0">Add an AI connection in the previous step to continue.</p> : null}
    {selected?.kind === 'acp' && <div className="space-y-2 rounded-sm bg-crust p-3">
      <p className="text-xs text-subtext0">This reviewer uses the agent’s default model and settings.</p>
      <label className="flex items-start gap-2 text-xs leading-5 text-subtext1">
        <input type="checkbox" checked={consentedAcpAgentId === selected.id}
          onChange={(event) => setConsentedAcpAgentId(event.target.checked ? selected.id : null)} className="mt-0.5 accent-brand" />
        <span>I allow this agent to receive eligible changed-file diffs and review context. Sensitive paths are excluded and matching secret lines are redacted, but detection may miss some secrets.</span>
      </label>
    </div>}
    <button type="submit" disabled={!name.trim() || !selected || (selected.kind === 'acp' && consentedAcpAgentId !== selected.id)}
      className="rounded-sm border-0 bg-brand px-3 py-2 text-xs font-semibold text-on-accent disabled:cursor-not-allowed disabled:opacity-45">
      Create first reviewer
    </button>
  </form>;
}
