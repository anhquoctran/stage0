import React, { useEffect, useRef, useState } from 'react';
import { X } from '../../../common/components/icons/X';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { useReviewStore } from '../store/useReviewStore';
import { useAiMcpStore } from '../../ai/store/useAiMcpStore';
import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import { formatDateTime } from '../../../common/utils/dateTime';
import { ReviewFindingCard } from './ReviewFindingCard';
import { HarnessConnectionsPanel } from './HarnessConnectionsPanel';

export const ReviewPanel: React.FC = () => {
  const { isOpen, sessionId, runs, detail, error, isStarting, isPublishing, activeRuns, syncActive, close, load, start, cancel, publish } = useReviewStore();
  const config = useAiMcpStore((state) => state.aiConfig);
  const [allowRemote, setAllowRemote] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const run = detail?.run;
  const running = run?.status === 'running';
  const hasRunning = running || runs.some((item) => item.status === 'running');
  const activeIds = Object.keys(activeRuns).sort().join(',');
  const compatible = config.provider === 'ollama' || (config.provider !== 'github_copilot' && (!config.authMode || config.authMode === 'api_key'));

  useEffect(() => { setAllowRemote(false); }, [config.provider, config.baseUrl, sessionId]);
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
          <h2 id="review-panel-title" className="text-sm font-semibold">AI code review · read-only</h2>
          <button type="button" onClick={close} aria-label="Close review panel" title="Close panel; running review continues in the background" className="w-12 h-12 grid place-items-center hover:bg-surface0"><X className="w-5 h-5" /></button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5 space-y-4">
          <div className="border border-surface1 bg-base p-3 space-y-2 text-xs">
            <p>Provider: <strong>{config.provider}</strong> · Model: <span className="font-mono">{config.model}</span>{config.reasoningEffort && <> · Reasoning: <strong>{config.reasoningEffort}</strong></>}{config.fastMode && <> · <strong>Fast mode</strong></>}</p>
            <p className="break-all text-subtext0">Endpoint: {config.baseUrl}</p>
            <p className="text-subtext0">Reads committed Git snapshots only. No terminal, file writes, auto-resolution or MR approval. A completed review does not prove the code is safe.</p>
            <p className="text-subtext0">Native reviews are non-streaming and use fixed safety budgets (12 turns, 48 tool calls, up to 2,048 requested output tokens per turn), independent of chat streaming and auto-summary preferences.</p>
            {!compatible && <p role="alert" className="text-yellow">Choose API-key authentication or local Ollama in AI Preferences. CLI/subscription bridges are not used by this native tool-calling runtime.</p>}
            <button type="button" className="text-primary underline" onClick={() => { close(); usePreferencesStore.getState().openPreferences('ai-providers'); }}>AI Preferences</button>
            {config.provider !== 'ollama' && <label className="flex gap-2 items-start">
              <input type="checkbox" checked={allowRemote} onChange={(event) => setAllowRemote(event.target.checked)} className="accent-primary mt-0.5" />
              <span>I allow eligible tracked source to be sent to this provider. Sensitive files are excluded and matching secret lines are redacted, but automatic detection cannot identify every secret.</span>
            </label>}
            <div className="flex gap-2 pt-1">
              <button type="button" disabled={!compatible || isStarting || hasRunning || (config.provider !== 'ollama' && !allowRemote)} onClick={() => void start(config, allowRemote)} className="bg-primary text-on-accent px-3 py-2 font-semibold disabled:opacity-40">{isStarting ? 'Capturing snapshot…' : 'Start new review'}</button>
              {running && <button type="button" onClick={() => void cancel()} className="border border-surface1 px-3 py-2">Cancel review</button>}
              {running && <button type="button" onClick={close} className="border border-surface1 px-3 py-2">Run in background</button>}
            </div>
          </div>
          {error && <p role="alert" className="border border-red/40 p-3 text-xs text-red whitespace-pre-wrap">{error}</p>}
          <HarnessConnectionsPanel />
          {runs.length > 0 && <CustomSelect value={run?.id || runs[0].id} onChange={(id) => sessionId && void load(sessionId, id)} options={runs.map((item) => ({ value: item.id, label: `${formatDateTime(item.startedAt)} · ${item.status} · ${item.model}` }))} aria-label="Review run history" className="w-full" buttonClassName="w-full" dropdownWidth="w-full" align="left" />}
          {!run && <p className="text-xs text-subtext0">No review run selected. Start a review or choose one from history.</p>}
          {run && <>
            <section className="border border-surface1 p-3 space-y-2 text-xs">
              <p role="status"><strong className="uppercase">{run.status}</strong> · {run.provider} / {run.model} · {run.findings.length} findings</p>
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
