import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { X } from '../../../common/components/icons/X';
import { formatDateTime } from '../../../common/utils/dateTime';
import { AI_PROVIDERS } from '../../ai/constants/aiPresets';
import { useAiMcpStore } from '../../ai/store/useAiMcpStore';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import { useReviewStore } from '../store/useReviewStore';
import type { ReviewBotConfig } from '../types/ReviewBotConfig';
import { resolveReviewBotConfig } from '../utils/resolveReviewBotConfig';
import { HarnessConnectionsPanel } from './HarnessConnectionsPanel';
import { ReviewConfigurationSection } from './ReviewConfigurationSection';
import { ReviewFindingCard } from './ReviewFindingCard';
import { ReviewRunSummary } from './ReviewRunSummary';

const GLOBAL_REVIEWER_ID = '__stage0_global_ai_config__';

export const ReviewPanel: React.FC = () => {
  const {
    isOpen,
    sessionId,
    runs,
    detail,
    error,
    isStarting,
    isPublishing,
    activeRuns,
    syncActive,
    close,
    load,
    start,
    cancel,
    publish,
  } = useReviewStore();
  const config = useAiMcpStore((state) => state.aiConfig);
  const dynamicModels = useAiMcpStore((state) => state.dynamicModels);
  const externalAgents = useAiMcpStore((state) => state.externalAgents);
  const session = useVirtualMrStore(
    (state) => state.sessions.find((item) => item.id === sessionId) || null
  );
  const globalReviewers = useBotReviewersStore((state) => state.globalReviewers);
  const repoCustomReviewers = useBotReviewersStore((state) => state.repoCustomReviewers);
  const [allowRemote, setAllowRemote] = useState(false);
  const [selectedReviewerId, setSelectedReviewerId] = useState(GLOBAL_REVIEWER_ID);
  const panelRef = useRef<HTMLDivElement>(null);
  const run = detail?.run;
  const running = run?.status === 'running';
  const hasRunning = running || runs.some((item) => item.status === 'running');
  const activeIds = Object.keys(activeRuns).sort().join(',');
  const reviewerProfiles = useMemo(() => {
    if (!session) return [];
    const assignedIds = new Set(session.reviewers.map((reviewer) => reviewer.agentId));
    const configured = [...globalReviewers, ...(repoCustomReviewers[session.repoId] || [])];
    const unique = new Map<string, BotReviewer>();
    for (const bot of configured)
      if (assignedIds.has(bot.id) && !unique.has(bot.id)) unique.set(bot.id, bot);
    return [...unique.values()];
  }, [session, globalReviewers, repoCustomReviewers]);
  const effectiveReviewerId = reviewerProfiles.some((bot) => bot.id === selectedReviewerId)
    ? selectedReviewerId
    : GLOBAL_REVIEWER_ID;
  const selectedReviewer = reviewerProfiles.find((bot) => bot.id === effectiveReviewerId);
  const reviewerProvider =
    selectedReviewer?.provider && selectedReviewer.provider !== 'global_default'
      ? selectedReviewer.provider
      : config.provider;
  const reviewConfig: ReviewBotConfig = selectedReviewer
    ? resolveReviewBotConfig(
        config,
        selectedReviewer,
        dynamicModels[reviewerProvider as keyof typeof dynamicModels] || [],
        externalAgents
      )
    : { ...config, reviewerRole: 'custom', customInstructions: config.reviewerInstructions };
  const compatible =
    reviewConfig.executionMode === 'acp'
      ? Boolean(reviewConfig.acpAgent)
      : AI_PROVIDERS.some((provider) => provider.id === reviewConfig.provider);
  const acpConfigSummary = Object.entries(reviewConfig.acpConfigOptions || {})
    .map(([id, value]) => `${id}: ${String(value)}`)
    .join(' · ');

  useEffect(() => {
    setAllowRemote(false);
  }, [
    reviewConfig.provider,
    reviewConfig.model,
    reviewConfig.baseUrl,
    reviewConfig.acpAgent?.id,
    effectiveReviewerId,
    sessionId,
  ]);
  useEffect(() => {
    setSelectedReviewerId(reviewerProfiles[0]?.id || GLOBAL_REVIEWER_ID);
  }, [sessionId, reviewerProfiles]);
  useEffect(() => {
    if (!sessionId || !isOpen) return;
    void load(sessionId);
  }, [sessionId, isOpen, load]);
  useEffect(() => {
    if (!activeIds) return;
    const timer = setInterval(() => void syncActive(), 1500);
    return () => clearInterval(timer);
  }, [activeIds, syncActive]);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement;
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-x-0 top-8.5 bottom-0 z-[140] bg-crust/75 p-4 flex items-center justify-center"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
        if (event.key === 'Tab') {
          const elements = panelRef.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),[tabindex="0"]'
          );
          const first = elements?.[0];
          const last = elements?.[elements.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-panel-title"
        className="w-full max-w-5xl max-h-full bg-mantle border border-surface1 shadow-2xl flex flex-col text-text"
      >
        <header className="flex items-center justify-between border-b border-surface0 pl-5 shrink-0">
          <h2 id="review-panel-title" className="text-sm font-semibold">
            AI code review
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close review panel"
            title="Close panel; running review continues in the background"
            className="w-12 h-12 grid place-items-center hover:bg-surface0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5 space-y-4">
          <ReviewConfigurationSection
            session={session}
            effectiveReviewerId={effectiveReviewerId}
            setSelectedReviewerId={setSelectedReviewerId}
            GLOBAL_REVIEWER_ID={GLOBAL_REVIEWER_ID}
            config={config}
            reviewerProfiles={reviewerProfiles}
            externalAgents={externalAgents}
            selectedReviewer={selectedReviewer}
            reviewConfig={reviewConfig}
            acpConfigSummary={acpConfigSummary}
            compatible={compatible}
            close={close}
            allowRemote={allowRemote}
            setAllowRemote={setAllowRemote}
            isStarting={isStarting}
            hasRunning={hasRunning}
            start={start}
            running={running}
            cancel={cancel}
          />
          {error && (
            <p
              role="alert"
              className="border border-red/40 p-3 text-xs text-red whitespace-pre-wrap"
            >
              {error}
            </p>
          )}
          <HarnessConnectionsPanel />
          {runs.length > 0 && (
            <CustomSelect
              value={run?.id || runs[0].id}
              onChange={(id) => sessionId && void load(sessionId, id)}
              options={runs.map((item) => ({
                value: item.id,
                label: `${formatDateTime(item.startedAt)} · ${item.reviewerName ? `${item.reviewerName} · ` : ''}${item.status} · ${item.model}`,
              }))}
              aria-label="Review run history"
              className="w-full"
              buttonClassName="w-full"
              dropdownWidth="w-full"
              align="left"
            />
          )}
          {!run && (
            <p className="text-xs text-subtext0">
              No review run selected. Start a review or choose one from history.
            </p>
          )}
          {run && (
            <>
              <ReviewRunSummary run={run} isPublishing={isPublishing} publish={publish} />
              <div className="space-y-3">
                {run.findings.map((finding, index) => (
                  <ReviewFindingCard key={`${run.id}-${index}`} finding={finding} />
                ))}
              </div>
              {detail.events.length > 0 && (
                <details className="text-xs">
                  <summary>Run trace (metadata only)</summary>
                  <ol className="mt-2 space-y-1 max-h-40 overflow-auto font-mono text-[11px] text-subtext0">
                    {detail.events.map((event) => (
                      <li key={event.seq}>
                        {event.kind} · {JSON.stringify(event.detail)}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
