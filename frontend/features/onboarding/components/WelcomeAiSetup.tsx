import { useMemo, useState } from 'react';
import { AiMcpTab } from '../../ai/components/AiMcpTab';
import { ExternalAgentsTab } from '../../ai/components/ExternalAgentsTab';
import type { AiConfig } from '../../ai/types/AiConfig';
import type { WelcomeAiSetupProps } from '../types/WelcomeAiSetupProps';

export function WelcomeAiSetup({ setup }: WelcomeAiSetupProps) {
  const [route, setRoute] = useState<'provider' | 'acp'>('provider');

  const triggerAutoSave = () => {
    queueMicrotask(() => {
      void setup.save();
    });
  };

  const autoSaveDraft = useMemo(
    () => ({
      ...setup.draft,
      updateAiConfig: (partial: Partial<AiConfig>) => {
        setup.draft.updateAiConfig(partial);
        if ('configuredProviders' in partial) {
          triggerAutoSave();
        }
      },
      removeApiKey: (provider: AiConfig['provider']) => {
        setup.draft.removeApiKey(provider);
        triggerAutoSave();
      },
      updateExternalAgents: (agents: typeof setup.draft.externalAgents) => {
        setup.draft.updateExternalAgents(agents);
        triggerAutoSave();
      },
    }),
    [setup]
  );

  return (
    <div className="space-y-4 rounded-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-surface0 p-3 text-xs leading-5 text-subtext1" role="status">
        <span>
          {setup.connections.length
            ? `Saved connection: ${setup.connections.join(', ')}.`
            : 'AI connection required — add an LLM provider or install an ACP agent to continue.'}
        </span>
        <div className="flex items-center gap-2">
          {route === 'provider' && (setup.draft.aiConfig.configuredProviders?.length ?? 0) > 0 && (
            <button
              type="button"
              disabled={setup.busy}
              onClick={() => {
                void setup.checkSavedKeys();
              }}
              className="rounded-sm bg-surface1 px-2.5 py-1 text-[11px] font-semibold text-text hover:bg-surface2 disabled:opacity-40"
            >
              Check saved API keys
            </button>
          )}
          <span
            className={`rounded-sm px-2.5 py-0.5 text-[11px] font-semibold text-white ${
              setup.connections.length ? 'bg-emerald-600' : 'bg-amber-600'
            }`}
          >
            {setup.busy ? 'Saving…' : setup.connections.length ? 'Connected' : 'Required'}
          </span>
        </div>
      </div>

      <fieldset disabled={setup.busy} className="min-w-0 space-y-4">
        <div className="flex gap-2 rounded-sm" aria-label="AI connection method">
          {(['provider', 'acp'] as const).map((method) => (
            <button
              key={method}
              type="button"
              aria-pressed={route === method}
              onClick={() => setRoute(method)}
              className={`rounded-sm px-3.5 py-2 text-xs font-semibold transition-colors ${
                route === method
                  ? 'border-0 bg-brand text-white'
                  : 'border border-surface1 bg-crust text-subtext0 hover:text-text'
              }`}
            >
              {method === 'provider' ? 'LLM Provider' : 'ACP Agent'}
            </button>
          ))}
        </div>

        {route === 'provider' ? (
          <AiMcpTab
            activeView="providers"
            draftSettings={autoSaveDraft}
            draftAiConfig={setup.draft.aiConfig}
            onUpdateAiConfig={autoSaveDraft.updateAiConfig}
          />
        ) : (
          <ExternalAgentsTab draftSettings={autoSaveDraft} isOnboarding />
        )}
      </fieldset>

      {setup.error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm bg-red/10 p-3 text-xs text-red">
          <p role="alert">{setup.error}</p>
          {setup.hasChanges && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void setup.save();
                }}
                className="rounded-sm bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                Retry save
              </button>
              <button
                type="button"
                onClick={setup.discard}
                className="rounded-sm bg-surface0 px-2.5 py-1 text-[11px] font-semibold text-text hover:bg-surface1"
              >
                Discard draft
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
