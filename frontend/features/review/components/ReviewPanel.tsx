import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from '../../../common/components/icons/X';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { useReviewStore } from '../store/useReviewStore';
import { useAiMcpStore } from '../../ai/store/useAiMcpStore';
import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import { formatDateTime } from '../../../common/utils/dateTime';
import { ReviewFindingCard } from './ReviewFindingCard';
import { HarnessConnectionsPanel } from './HarnessConnectionsPanel';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import { useBotReviewersStore } from '../../ai/store/useBotReviewersStore';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';
import { AI_PROVIDERS } from '../../ai/constants/aiPresets';
import { resolveReviewBotConfig } from '../utils/resolveReviewBotConfig';
import type { ReviewBotConfig } from '../types/ReviewBotConfig';

const GLOBAL_REVIEWER_ID = '__stage0_global_ai_config__';

export const ReviewPanel: React.FC = () => {
  const { isOpen, sessionId, runs, detail, error, isStarting, isPublishing, activeRuns, syncActive, close, load, start, cancel, publish } = useReviewStore();
  const config = useAiMcpStore((state) => state.aiConfig);
  const dynamicModels = useAiMcpStore((state) => state.dynamicModels);
  const externalAgents = useAiMcpStore((state) => state.externalAgents);
  const session = useVirtualMrStore((state) => state.sessions.find((item) => item.id === sessionId) || null);
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
    for (const bot of configured) if (assignedIds.has(bot.id) && !unique.has(bot.id)) unique.set(bot.id, bot);
    return [...unique.values()];
  }, [session, globalReviewers, repoCustomReviewers]);
  const effectiveReviewerId = reviewerProfiles.some((bot) => bot.id === selectedReviewerId)
    ? selectedReviewerId
    : GLOBAL_REVIEWER_ID;
  const selectedReviewer = reviewerProfiles.find((bot) => bot.id === effectiveReviewerId);
  const reviewerProvider = selectedReviewer?.provider && selectedReviewer.provider !== 'global_default'
    ? selectedReviewer.provider
    : config.provider;
  const reviewConfig: ReviewBotConfig = selectedReviewer
    ? resolveReviewBotConfig(config, selectedReviewer, dynamicModels[reviewerProvider as keyof typeof dynamicModels] || [], externalAgents)
    : { ...config, reviewerRole: 'custom', customInstructions: config.reviewerInstructions };
  const compatible = reviewConfig.executionMode === 'acp'
    ? Boolean(reviewConfig.acpAgent)
    : AI_PROVIDERS.some((provider) => provider.id === reviewConfig.provider);

  useEffect(() => { setAllowRemote(false); }, [reviewConfig.provider, reviewConfig.model, reviewConfig.baseUrl, reviewConfig.acpAgent?.id, effectiveReviewerId, sessionId]);
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
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-x-0 top-8.5 bottom-0 z-[140] bg-crust/75 p-4 flex items-center justify-center" onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const elements = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]');
        const first = elements?.[0]; const last = elements?.[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="review-panel-title" className="w-full max-w-5xl max-h-full bg-mantle border border-surface1 shadow-2xl flex flex-col text-text">
        <header className="flex items-center justify-between border-b border-surface0 pl-5 shrink-0">
          <h2 id="review-panel-title" className="text-sm font-semibold">AI code review</h2>
          <button type="button" onClick={close} aria-label="Close review panel" title="Close panel; running review continues in the background" className="w-12 h-12 grid place-items-center hover:bg-surface0"><X className="w-5 h-5" /></button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5 space-y-4">
          <div className="border border-surface1 bg-base p-3 space-y-2 text-xs">
            {session && <CustomSelect
              value={effectiveReviewerId}
              onChange={setSelectedReviewerId}
              options={[
                { value: GLOBAL_REVIEWER_ID, label: `Global AI preferences (${config.model})` },
                ...reviewerProfiles.map((bot) => ({
                  value: bot.id,
                  label: bot.acpAgentId
                    ? `${bot.name} · ACP: ${externalAgents.find((agent) => agent.id === bot.acpAgentId)?.name || 'Agent unavailable'}`
                    : `${bot.name} · ${bot.model && bot.model !== 'global_default'
                    ? bot.model
                    : bot.provider && bot.provider !== 'global_default'
                      ? AI_PROVIDERS.find((provider) => provider.id === bot.provider)?.defaultModel || config.model
                      : config.model}`,
                  description: bot.tagline,
                })),
              ]}
              aria-label="Review profile"
              className="w-full"
              buttonClassName="w-full"
              dropdownWidth="w-full"
              align="left"
            />}
            <p>{selectedReviewer ? <>Reviewer: <strong>{selectedReviewer.name}</strong> · </> : null}{reviewConfig.executionMode === 'acp' ? <>ACP agent: <strong>{reviewConfig.acpAgent?.name || 'Unavailable'}</strong></> : <>Provider: <strong>{reviewConfig.provider}</strong> · Model: <span className="font-mono">{reviewConfig.model}</span>{reviewConfig.reasoningEffort && <> · Reasoning: <strong>{reviewConfig.reasoningEffort}</strong></>}{reviewConfig.fastMode && <> · <strong>Fast mode</strong></>}</>}</p>
            {reviewConfig.executionMode === 'acp' ? <p className="text-subtext0">Agent: {reviewConfig.acpAgent?.name || 'Not installed'} · configured in AI Preferences → External Agents</p> : <p className="break-all text-subtext0">Endpoint: {reviewConfig.baseUrl}</p>}
            {selectedReviewer && <p className="text-subtext0">This run uses the selected reviewer’s instructions and model profile.</p>}
            <p className="text-subtext0">Reads committed Git snapshots only. It can create inline discussions, reply to user comments, and resolve threads with changed-line evidence. It cannot modify code, approve, or merge. Discussion actions are saved to this local Virtual MR.</p>
            <p className="text-subtext0">Reviews use fixed safety budgets (12 turns, 48 tool calls and a 64,000-token reported-usage cap), independent of chat auto-summary preferences. ACP agent turns use a structured Stage0 tool-call bridge; reported token usage may not be available.</p>
            {!compatible && <p role="alert" className="text-yellow">{reviewConfig.executionMode === 'acp' ? 'The selected ACP agent is not installed. Reinstall it or update this reviewer profile.' : 'Choose a built-in provider with an API key or local Ollama for code reviews.'}</p>}
            <button type="button" className="text-primary underline" onClick={() => { close(); usePreferencesStore.getState().openPreferences('ai-providers'); }}>AI Preferences</button>
            {(reviewConfig.executionMode === 'acp' || reviewConfig.provider !== 'ollama') && <label className="flex gap-2 items-start">
              <input type="checkbox" checked={allowRemote} onChange={(event) => setAllowRemote(event.target.checked)} className="accent-primary mt-0.5" />
              <span>I allow eligible tracked source to be sent to {reviewConfig.executionMode === 'acp' ? `ACP agent ${reviewConfig.acpAgent?.name || ''}` : reviewConfig.provider}. Sensitive files are excluded and matching secret lines are redacted, but automatic detection cannot identify every secret.</span>
            </label>}
            <div className="flex gap-2 pt-1">
              <button type="button" disabled={!compatible || isStarting || hasRunning || ((reviewConfig.executionMode === 'acp' || reviewConfig.provider !== 'ollama') && !allowRemote)} onClick={() => void start(reviewConfig, allowRemote, selectedReviewer ? { id: selectedReviewer.id, name: selectedReviewer.name } : undefined)} className="bg-primary text-on-accent px-3 py-2 font-semibold disabled:opacity-40">{isStarting ? 'Capturing snapshot…' : selectedReviewer ? `Review as ${selectedReviewer.name}` : 'Start new review'}</button>
              {running && <button type="button" onClick={() => void cancel()} className="border border-surface1 px-3 py-2">Cancel review</button>}
              {running && <button type="button" onClick={close} className="border border-surface1 px-3 py-2">Run in background</button>}
            </div>
          </div>
          {error && <p role="alert" className="border border-red/40 p-3 text-xs text-red whitespace-pre-wrap">{error}</p>}
          <HarnessConnectionsPanel />
          {runs.length > 0 && <CustomSelect value={run?.id || runs[0].id} onChange={(id) => sessionId && void load(sessionId, id)} options={runs.map((item) => ({ value: item.id, label: `${formatDateTime(item.startedAt)} · ${item.reviewerName ? `${item.reviewerName} · ` : ''}${item.status} · ${item.model}` }))} aria-label="Review run history" className="w-full" buttonClassName="w-full" dropdownWidth="w-full" align="left" />}
          {!run && <p className="text-xs text-subtext0">No review run selected. Start a review or choose one from history.</p>}
          {run && <>
            <section className="border border-surface1 p-3 space-y-2 text-xs">
              <p role="status"><strong className="uppercase">{run.status}</strong>{run.reviewerName && <> · {run.reviewerName}</>} · {run.provider} / {run.model} · {run.findings.length} findings</p>
              <p className="break-all text-subtext0">Run endpoint: {run.endpoint}</p>
              <p className="font-mono text-[11px] break-all">{run.snapshot.repoPath}<br />base {run.snapshot.baseSha}<br />head {run.snapshot.headSha}<br />merge-base {run.snapshot.mergeBaseSha}</p>
              <p className="text-subtext0">{run.inspectedFiles.length} inspected paths · {run.snapshot.changedFiles.length} eligible changed paths · {run.snapshot.excludedFiles.length} excluded · {run.turns}/12 turns · {run.toolCalls}/48 tool calls · {run.usageTokens} reported tokens</p>
              {(run.status === 'partial' || run.status === 'incomplete') && <p className="text-yellow">Incomplete coverage. Some source was excluded, redacted, unread, or a tool/budget limit was reached. Do not interpret zero findings as approval.</p>}
              {run.error && <p role="alert" className="text-red whitespace-pre-wrap">{run.error}</p>}
              <p className="whitespace-pre-wrap select-text">{run.summary}</p>
              {run.snapshot.excludedFiles.length > 0 && <details><summary>Excluded changed paths</summary><pre className="max-h-28 overflow-auto text-[11px]">{run.snapshot.excludedFiles.join('\n')}</pre></details>}
              {['completed', 'partial'].includes(run.status) && run.findings.length > 0 && <button type="button" disabled={run.published || isPublishing} onClick={() => void publish()} className="border border-primary text-primary px-3 py-2 disabled:opacity-40">{run.published ? 'Published to discussions' : isPublishing ? 'Publishing…' : 'Publish findings to discussions'}</button>}
            </section>
            <div className="space-y-3">{run.findings.map((finding, index) => <ReviewFindingCard key={`${run.id}-${index}`} finding={finding} />)}</div>
            {detail.events.length > 0 && <details className="text-xs"><summary>Run trace (metadata only)</summary><ol className="mt-2 space-y-1 max-h-40 overflow-auto font-mono text-[11px] text-subtext0">{detail.events.map((event) => <li key={event.seq}>{event.kind} · {JSON.stringify(event.detail)}</li>)}</ol></details>}
          </>}
        </div>
      </div>
    </div>
  );
};
