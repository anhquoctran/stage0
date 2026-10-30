import { useMemo, useState } from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { AiMcpTab } from '../../ai/components/AiMcpTab';
import { ExternalAgentsTab } from '../../ai/components/ExternalAgentsTab';
import type { AiConfig } from '../../ai/types/AiConfig';
import type { WelcomeAiSetupProps } from '../types/WelcomeAiSetupProps';

export function WelcomeAiSetup({ setup }: WelcomeAiSetupProps) {
  const { t: translateUiText } = useUiTextTranslation();
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
            ? translateUiText('onboarding.aiSetup.savedConnection', { connections: setup.connections.join(', ') })
            : translateUiText('onboarding.aiSetup.connectionRequired')}
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
              {translateUiText('onboarding.aiSetup.checkSavedKeys')}
            </button>
          )}
          <span
            className={`rounded-sm px-2.5 py-0.5 text-[11px] font-semibold text-white ${
              setup.connections.length ? 'bg-emerald-600' : 'bg-amber-600'
            }`}
          >
            {translateUiText(setup.busy ? 'onboarding.aiSetup.saving' : setup.connections.length ? 'onboarding.aiSetup.connected' : 'onboarding.aiSetup.required')}
          </span>
        </div>
      </div>

      <fieldset disabled={setup.busy} className="min-w-0 space-y-4">
        <div className="flex gap-2 rounded-sm" aria-label={translateUiText('onboarding.aiSetup.connectionMethod')}>
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
              {translateUiText(method === 'provider' ? 'onboarding.aiSetup.llmProvider' : 'onboarding.aiSetup.acpAgent')}
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
                {translateUiText('onboarding.aiSetup.retrySave')}
              </button>
              <button
                type="button"
                onClick={setup.discard}
                className="rounded-sm bg-surface0 px-2.5 py-1 text-[11px] font-semibold text-text hover:bg-surface1"
              >
                {translateUiText('onboarding.aiSetup.discardDraft')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
