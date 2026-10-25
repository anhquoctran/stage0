import { useState } from 'react';
import { AiMcpTab } from '../../ai/components/AiMcpTab';
import { BotReviewersTab } from '../../ai/components/BotReviewersTab';
import { ExternalAgentsTab } from '../../ai/components/ExternalAgentsTab';
import type { WelcomeAiSetupProps } from '../types/WelcomeAiSetupProps';

export function WelcomeAiSetup({ setup }: WelcomeAiSetupProps) {
  const [route, setRoute] = useState<'provider' | 'acp'>('provider');
  const [step, setStep] = useState<'connection' | 'reviewer'>('connection');
  return <div className="space-y-4 rounded-sm">
    <p className="text-sm leading-6 text-subtext1">
      Required — save an LLM provider or ACP agent, then create and save at least one enabled custom reviewer bot.
    </p>
    <div className="flex flex-wrap gap-2 rounded-sm" aria-label="Required AI setup steps">
      {(['connection', 'reviewer'] as const).map((setupStep, index) => <button key={setupStep} type="button"
        aria-pressed={step === setupStep} disabled={setup.busy} onClick={() => setStep(setupStep)}
        className={`rounded-sm px-3 py-2 text-xs font-semibold ${step === setupStep ? 'border-0 bg-surface0 text-text' : 'border border-surface0 text-subtext0'}`}>
        {index + 1}. {setupStep === 'connection' ? 'AI connection' : 'First reviewer'}
      </button>)}
    </div>
    <fieldset disabled={setup.busy} className="min-w-0 space-y-4">
      {step === 'connection' ? <>
        <div className="flex gap-2 rounded-sm" aria-label="AI connection method">
          {(['provider', 'acp'] as const).map((method) => <button key={method} type="button"
            aria-pressed={route === method} onClick={() => setRoute(method)}
            className={`rounded-sm px-3 py-2 text-xs font-semibold ${route === method ? 'border-0 bg-surface0 text-text' : 'border border-surface0 text-subtext0'}`}>
            {method === 'provider' ? 'LLM Provider' : 'ACP Agent'}
          </button>)}
        </div>
        {route === 'provider' ? <AiMcpTab activeView="providers" draftSettings={setup.draft}
          draftAiConfig={setup.draft.aiConfig} onUpdateAiConfig={setup.draft.updateAiConfig} /> :
          <ExternalAgentsTab draftSettings={setup.draft} />}
      </> : <div className="space-y-3 rounded-sm">
        <p className="text-xs leading-5 text-subtext0">Create and save your first enabled custom reviewer. Built-in reviewer presets do not satisfy this requirement.</p>
        <BotReviewersTab draftSettings={setup.draft} />
      </div>}
      <div className="flex flex-wrap items-center gap-2 rounded-sm">
        <button type="button" onClick={() => { void setup.save(); }} disabled={!setup.hasChanges}
          className="rounded-sm border-0 bg-surface0 px-3 py-2 text-xs font-semibold text-text hover:bg-surface1 disabled:opacity-40">
          {setup.busy ? 'Saving…' : 'Save AI setup'}
        </button>
        <button type="button" onClick={setup.discard} disabled={!setup.hasChanges}
          className="rounded-sm px-3 py-2 text-xs text-subtext1 hover:bg-surface0 disabled:opacity-40">Discard draft</button>
        {step === 'connection' && route === 'provider' && <button type="button" onClick={() => { void setup.checkSavedKeys(); }}
          className="rounded-sm px-3 py-2 text-xs text-subtext1 hover:bg-surface0">Check saved API keys</button>}
      </div>
    </fieldset>
    {setup.error && <p role="alert" className="text-xs text-red">{setup.error}</p>}
    <div role="status" className="space-y-1 rounded-sm bg-surface0 p-3 text-xs leading-5 text-subtext1">
      <p>{setup.connections.length ? `Saved connection: ${setup.connections.join(', ')}.` : 'AI connection required — unsaved drafts do not count.'}</p>
      <p>{setup.hasSavedRequiredReviewer ? 'First custom reviewer is saved and enabled.' : setup.hasRequiredReviewer ? 'First reviewer is drafted; save AI setup to continue.' : 'Enabled custom reviewer required — add one in the First reviewer step.'}</p>
    </div>
    <p className="text-xs leading-5 text-subtext0">
      API keys are stored in your OS keychain; Check saved API keys reads them. For ACP, add an agent and sign in through Manage if needed.
      Saving only stores your setup—it doesn’t test access, send repository code, or run a review.
    </p>
  </div>;
}
