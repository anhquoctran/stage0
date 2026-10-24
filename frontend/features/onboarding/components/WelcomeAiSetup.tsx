import { useState } from 'react';
import { AiMcpTab } from '../../ai/components/AiMcpTab';
import { ExternalAgentsTab } from '../../ai/components/ExternalAgentsTab';
import type { WelcomeAiSetupProps } from '../types/WelcomeAiSetupProps';

export function WelcomeAiSetup({ setup }: WelcomeAiSetupProps) {
  const [route, setRoute] = useState<'provider' | 'acp'>('provider');
  return <div className="space-y-4 rounded-sm">
    <p className="text-sm leading-6 text-subtext1">
      Required — save at least one LLM provider or ACP agent to continue. Choose either route; you do not need both.
    </p>
    <div className="flex gap-2 rounded-sm" aria-label="AI setup method">
      {(['provider', 'acp'] as const).map((method) => <button key={method} type="button"
        aria-pressed={route === method} onClick={() => setRoute(method)}
        className={`rounded-sm px-3 py-2 text-xs font-semibold ${route === method ? 'border-0 bg-surface0 text-text' : 'border border-surface0 text-subtext0'}`}>
        {method === 'provider' ? 'LLM Provider' : 'ACP Agent'}
      </button>)}
    </div>
    <fieldset disabled={setup.busy} className="min-w-0 space-y-4">
      {route === 'provider' ? <AiMcpTab activeView="providers" draftSettings={setup.draft}
        draftAiConfig={setup.draft.aiConfig} onUpdateAiConfig={setup.draft.updateAiConfig} /> :
        <ExternalAgentsTab draftSettings={setup.draft} />}
      <div className="flex flex-wrap items-center gap-2 rounded-sm">
        <button type="button" onClick={() => { void setup.save(); }} disabled={!setup.hasChanges}
          className="rounded-sm border-0 bg-surface0 px-3 py-2 text-xs font-semibold text-text hover:bg-surface1 disabled:opacity-40">
          {setup.busy ? 'Saving…' : 'Save AI setup'}
        </button>
        <button type="button" onClick={setup.discard} disabled={!setup.hasChanges}
          className="rounded-sm px-3 py-2 text-xs text-subtext1 hover:bg-surface0 disabled:opacity-40">Discard draft</button>
        {route === 'provider' && <button type="button" onClick={() => { void setup.checkSavedKeys(); }}
          className="rounded-sm px-3 py-2 text-xs text-subtext1 hover:bg-surface0">Check saved API keys</button>}
      </div>
    </fieldset>
    {setup.error && <p role="alert" className="text-xs text-red">{setup.error}</p>}
    <p role="status" className={`rounded-sm p-3 text-xs leading-5 ${setup.connections.length ? 'bg-green/10 text-text' : 'bg-surface0 text-subtext1'}`}>
      {setup.connections.length ? `Saved setup: ${setup.connections.join(', ')}.` : 'No eligible saved AI setup yet. Unsaved drafts do not count.'}
    </p>
    <p className="text-xs leading-5 text-subtext0">
      API keys are stored in your OS keychain; Check saved API keys reads them. For ACP, add an agent and sign in through Manage if needed.
      Saving only stores your setup—it doesn’t test access, send repository code, or run a review.
    </p>
  </div>;
}
