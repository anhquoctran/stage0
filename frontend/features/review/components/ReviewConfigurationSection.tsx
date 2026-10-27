import { CustomSelect } from '../../../common/components/CustomSelect';
import { AI_PROVIDERS } from '../../ai/constants/aiPresets';
import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import { getManualReviewBlockReason } from '../../virtual-mr/utils/manualReviewAvailability';
import type { ReviewConfigurationSectionProps } from './ReviewConfigurationSectionProps';

export function ReviewConfigurationSection({
  session,
  effectiveReviewerId,
  setSelectedReviewerId,
  GLOBAL_REVIEWER_ID,
  config,
  reviewerProfiles,
  externalAgents,
  selectedReviewer,
  reviewConfig,
  acpConfigSummary,
  compatible,
  close,
  allowRemote,
  setAllowRemote,
  isStarting,
  hasRunning,
  start,
  running,
  cancel,
}: ReviewConfigurationSectionProps) {
  const blockedReason = getManualReviewBlockReason(session);
  return (
    <div className="border border-surface1 bg-base p-3 space-y-2 text-xs rounded-sm">
      {session && (
        <CustomSelect
          value={effectiveReviewerId}
          onChange={setSelectedReviewerId}
          options={[
            { value: GLOBAL_REVIEWER_ID, label: `Global AI preferences (${config.model})` },
            ...reviewerProfiles.map((bot) => ({
              value: bot.id,
              label: bot.acpAgentId
                ? `${bot.name} · ACP: ${externalAgents.find((agent) => agent.id === bot.acpAgentId)?.name || 'Agent unavailable'}`
                : `${bot.name} · ${
                    bot.model && bot.model !== 'global_default'
                      ? bot.model
                      : bot.provider && bot.provider !== 'global_default'
                        ? AI_PROVIDERS.find((provider) => provider.id === bot.provider)
                            ?.defaultModel || config.model
                        : config.model
                  }`,
              description: bot.tagline,
            })),
          ]}
          aria-label="Review profile"
          className="w-full"
          buttonClassName="w-full"
          dropdownWidth="w-full"
          align="left"
        />
      )}
      <p>
        {selectedReviewer ? (
          <>
            Reviewer: <strong>{selectedReviewer.name}</strong> ·{' '}
          </>
        ) : null}
        {reviewConfig.executionMode === 'acp' ? (
          <>
            ACP agent: <strong>{reviewConfig.acpAgent?.name || 'Unavailable'}</strong>
          </>
        ) : (
          <>
            Provider: <strong>{reviewConfig.provider}</strong> · Model:{' '}
            <span className="font-mono">{reviewConfig.model}</span>
            {reviewConfig.reasoningEffort && (
              <>
                {' '}
                · Reasoning: <strong>{reviewConfig.reasoningEffort}</strong>
              </>
            )}
            {reviewConfig.fastMode && (
              <>
                {' '}
                · <strong>Fast mode</strong>
              </>
            )}
          </>
        )}
      </p>
      {reviewConfig.executionMode === 'acp' ? (
        <p className="text-subtext0">
          Agent: {reviewConfig.acpAgent?.name || 'Not installed'} · configured in AI Preferences →
          External Agents
        </p>
      ) : (
        <p className="break-all text-subtext0">Endpoint: {reviewConfig.baseUrl}</p>
      )}
      {reviewConfig.executionMode === 'acp' && selectedReviewer && (
        <p className="text-subtext0">
          Reviewer model settings: {acpConfigSummary || 'using agent defaults'}
        </p>
      )}
      {reviewConfig.executionMode === 'acp' && (
        <p className="text-yellow">
          Stage0 filters and redacts source, enforces its read/output limits, and validates every
          Stage0 review tool call. ACP agents are external processes: Stage0 cannot restrict tools
          or OS/network access the agent runs on its own, so use only agents you trust.
        </p>
      )}
      {selectedReviewer && (
        <p className="text-subtext0">
          This run uses the selected reviewer’s instructions and model profile.
        </p>
      )}
      <p className="text-subtext0">
        Summarizes the committed changes in the MR description, then reviews files and discussions.
        It can create inline discussions, reply to user comments, and resolve threads with
        changed-line evidence. It cannot modify code, approve, or merge. Discussion actions are
        saved to this local Virtual MR.
      </p>
      <p className="text-subtext0">
        Reviews use fixed safety budgets (128 turns, 256 tool calls and a 64,000-token
        reported-usage cap), independent of chat auto-summary preferences. ACP agent turns use a
        structured Stage0 tool-call bridge; reported token usage may not be available.
      </p>
      {!compatible && (
        <p role="alert" className="text-yellow">
          {reviewConfig.executionMode === 'acp'
            ? 'The selected ACP agent is not installed. Reinstall it or update this reviewer profile.'
            : 'Choose a built-in provider with an API key or local Ollama for code reviews.'}
        </p>
      )}
      <button
        type="button"
        className="text-primary underline rounded-sm"
        onClick={() => {
          close();
          usePreferencesStore.getState().openPreferences('ai-providers');
        }}
      >
        AI Preferences
      </button>
      {(reviewConfig.executionMode === 'acp' || reviewConfig.provider !== 'ollama') && (
        <label className="flex gap-2 items-start">
          <input
            type="checkbox"
            checked={allowRemote}
            onChange={(event) => setAllowRemote(event.target.checked)}
            className="accent-primary mt-0.5"
          />
          <span>
            I allow eligible tracked source to be sent to{' '}
            {reviewConfig.executionMode === 'acp'
              ? `ACP agent ${reviewConfig.acpAgent?.name || ''}`
              : reviewConfig.provider}
            . Sensitive files are excluded and matching secret lines are redacted, but automatic
            detection cannot identify every secret.
          </span>
        </label>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={
            !session || !compatible || !!blockedReason ||
            isStarting ||
            hasRunning ||
            ((reviewConfig.executionMode === 'acp' || reviewConfig.provider !== 'ollama') &&
              !allowRemote)
          }
          title={blockedReason || undefined}
          onClick={() => {
            if (blockedReason) return;
            void start(
              reviewConfig,
              allowRemote,
              selectedReviewer
                ? { id: selectedReviewer.id, name: selectedReviewer.name }
                : undefined
            );
          }}
          className="border-0 bg-primary text-on-accent px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40 rounded-sm"
        >
          {isStarting
            ? 'Capturing snapshot…'
            : selectedReviewer
              ? `Review as ${selectedReviewer.name}`
              : 'Start new review'}
        </button>
        {running && (
          <button
            type="button"
            onClick={() => void cancel()}
            className="border border-surface1 px-3 py-2 rounded-sm"
          >
            Cancel review
          </button>
        )}
        {running && (
          <button type="button" onClick={close} className="border border-surface1 px-3 py-2 rounded-sm">
            Run in background
          </button>
        )}
      </div>
      {blockedReason && <p role="status" className="text-subtext0">{blockedReason}</p>}
    </div>
  );
}
