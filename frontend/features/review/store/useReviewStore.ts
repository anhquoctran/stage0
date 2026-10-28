import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import { create } from 'zustand';

import type { ReviewState } from '../types/ReviewState';
import type { ReviewBotConfig } from '../types/ReviewBotConfig';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';
import { getManualReviewBlockReason } from '../../virtual-mr/utils/manualReviewAvailability';

const startingSessionIds = new Set<string>();

export function isReviewStartingForSession(sessionId: string): boolean {
  return startingSessionIds.has(sessionId);
}

let loadVersion = 0;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export const useReviewStore = create<ReviewState>((set, get) => ({
  isOpen: false, sessionId: null, runs: [], detail: null, error: null,
  isStarting: false, isPublishing: false,
  activeRuns: {},
  lastFinishedRun: null,
  reviewBatches: {},
  setReviewBatch: (sessionId, progress) => set((state) => {
    const reviewBatches = { ...state.reviewBatches };
    if (progress) reviewBatches[sessionId] = progress;
    else delete reviewBatches[sessionId];
    return { reviewBatches };
  }),
  syncActive: async () => {
    await Promise.all(Object.keys(get().activeRuns).map(async (id) => {
      try {
        const detail = await getApplicationServices().reviews.getAiReview({ runId: id });
        await get().syncRun(detail);
      } catch (error) { if (get().isOpen) set({ error: message(error) }); }
    }));
  },
  syncRun: async (detail) => {
    const { run } = detail;
    const previous = get().activeRuns[run.id];
    if (!previous) return;
    if (run.status === 'running' && (run.turns < previous.turns || (previous.generatedDescription && !run.generatedDescription))) return;
    const finished = run.status !== 'running';
    set((state) => {
      if (!state.activeRuns[run.id]) return state;
      const activeRuns = { ...state.activeRuns };
      if (finished) delete activeRuns[run.id]; else activeRuns[run.id] = run;
      return { activeRuns,
        ...(finished ? { lastFinishedRun: run } : {}),
        ...(state.detail?.run.id === run.id ? { detail } : {}),
        ...(state.sessionId === run.sessionId ? { runs: state.runs.map((item) => item.id === run.id ? run : item) } : {}),
      };
    });
    // The backend saves this description before exposing generatedDescription.
    // Apply it as soon as it appears, including if a later review step fails.
    if (!run.replyDiscussionId && run.generatedDescription?.trim() && run.generatedDescription !== previous.generatedDescription) {
      await useVirtualMrStore.getState().applyReviewGeneratedDescription(run.sessionId, run.generatedDescription);
    }
    if (!finished) return;
    await useVirtualMrStore.getState().refreshDiscussions(run.sessionId);
    if (run.reviewerId && !run.replyDiscussionId) {
      const reviewerStatus = run.status === 'completed' && run.decision === 'approve'
        ? 'approved'
        : run.decision === 'request_changes' || run.findings.length > 0
          ? 'changes_requested'
          : ['completed', 'partial'].includes(run.status)
            ? 'commented'
            : 'pending';
      await useVirtualMrStore.getState().setReviewerReviewStatus(run.sessionId, run.reviewerId, reviewerStatus);
      await useVirtualMrStore.getState().tryResolveSession(run.sessionId);
    }
    const { flushQueuedReReviewAfterActive } = await import('../services/assignedReviewService');
    void flushQueuedReReviewAfterActive(run.sessionId);
  },
  open: (sessionId) => {
    loadVersion++;
    set({ isOpen: true, sessionId, runs: [], detail: null, error: null });
  },
  close: () => { loadVersion++; set({ isOpen: false }); },
  load: async (sessionId, runId) => {
    const version = ++loadVersion;
    const trackedAtStart = new Set(Object.keys(get().activeRuns));
    // The Reviews tab selects history independently of the modal panel.
    if (get().sessionId !== sessionId) {
      set({ sessionId, runs: [], detail: null, error: null });
    }
    try {
      let runs = await getApplicationServices().reviews.listAiReviews({ sessionId });
      const selected = runId || (get().detail?.run.sessionId === sessionId ? get().detail?.run.id : undefined) || runs[0]?.id;
      let detail = selected ? await getApplicationServices().reviews.getAiReview({ runId: selected }) : null;
      if (version === loadVersion && get().sessionId === sessionId) {
        // A selected detail is fetched after the list and may already be final.
        runs = runs.map((run) => detail?.run.id === run.id ? detail.run : run);
        // Loading history may be the first observation of completion. Process
        // discussion/reviewer updates before retiring the tracked run.
        for (const run of runs) {
          if (run.status !== 'running' && get().activeRuns[run.id]) {
            await get().syncRun(detail?.run.id === run.id ? detail : { run, events: [] });
          }
        }
        if (version !== loadVersion || get().sessionId !== sessionId) return;
        // A poll may finish while history is in flight. Keep that newer result,
        // including its events, instead of resurrecting an older running view.
        runs = runs.map((run) => {
          const state = get();
          const known = state.activeRuns[run.id]
            || (state.lastFinishedRun?.id === run.id ? state.lastFinishedRun : null)
            || state.runs.find((item) => item.id === run.id);
          if (run.status !== 'running' || !trackedAtStart.has(run.id) || !known) return run;
          if (known.status !== 'running' || known.turns > run.turns
            || (known.generatedDescription && !run.generatedDescription)) {
            if (detail?.run.id === run.id) {
              detail = state.detail?.run.id === run.id ? state.detail : { run: known, events: [] };
            }
            return known;
          }
          return run;
        });
        const activeRuns = { ...get().activeRuns };
        for (const run of runs) {
          if (run.status === 'running' && !activeRuns[run.id] && !trackedAtStart.has(run.id)) {
            activeRuns[run.id] = run;
          }
        }
        set({ runs, detail, activeRuns, error: null });
      }
    } catch (error) {
      if (version === loadVersion && get().sessionId === sessionId) set({ error: message(error) });
    }
  },
  start: async (config: ReviewBotConfig, allowRemote, reviewer) => {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    const blockedReason = getManualReviewBlockReason(
      useVirtualMrStore.getState().sessions?.find((session) => session.id === sessionId),
    );
    if (blockedReason) { set({ error: blockedReason }); return; }
    try { await get().startForSession(sessionId, config, allowRemote, reviewer, true); }
    catch { /* The store records the error for the open review panel. */ }
  },
  startForSession: async (sessionId, config, allowRemote, reviewer, generateDescription = false, replyDiscussionId, manualReviewDiscussionId) => {
    if (startingSessionIds.has(sessionId) || Object.values(get().activeRuns).some((run) => run.sessionId === sessionId && run.status === 'running')) return null;
    startingSessionIds.add(sessionId);
    set({ isStarting: true, error: null });
    try {
      const run = await getApplicationServices().reviews.startAiReview({ request: {
        sessionId, provider: config.provider, authMode: 'api_key',
        model: config.model, baseUrl: config.baseUrl, reviewerRole: config.reviewerRole,
        instructions: config.customInstructions, allowRemote,
        executionMode: config.executionMode || 'provider', acpAgent: config.acpAgent || null,
        acpConfigOptions: config.acpConfigOptions || null,
        reasoningEffort: config.reasoningEffort || null, fastMode: config.fastMode === true,
        reviewerId: reviewer?.id || null, reviewerName: reviewer?.name || null,
        generateDescription,
        ...(replyDiscussionId ? { replyDiscussionId } : {}),
        ...(manualReviewDiscussionId ? { manualReviewDiscussionId } : {}),
      } });
      set((state) => ({ activeRuns: { ...state.activeRuns, [run.id]: run } }));
      if (run.reviewerId && !run.replyDiscussionId) {
        await useVirtualMrStore.getState().setReviewerReviewStatus(sessionId, run.reviewerId, 'reviewing');
      }
      if (get().sessionId === sessionId) {
        loadVersion++;
        set({ detail: { run, events: [] }, runs: [run, ...get().runs.filter((item) => item.id !== run.id)] });
      }
      return run;
    } catch (error) {
      if (get().sessionId === sessionId) set({ error: message(error) });
      throw error;
    }
    finally {
      startingSessionIds.delete(sessionId);
      set({ isStarting: startingSessionIds.size > 0 });
    }
  },
  cancel: async () => {
    const run = get().detail?.run;
    if (!run || run.status !== 'running') return;
    try { await getApplicationServices().reviews.cancelAiReview({ runId: run.id }); }
    catch (error) { if (get().detail?.run.id === run.id) set({ error: message(error) }); }
  },
  publish: async () => {
    const run = get().detail?.run;
    if (!run || get().isPublishing || !['completed', 'partial'].includes(run.status)) return;
    set({ isPublishing: true, error: null });
    try {
      await getApplicationServices().reviews.publishAiReview({ runId: run.id });
      await useVirtualMrStore.getState().refreshDiscussions(run.sessionId);
      if (get().isOpen && get().sessionId === run.sessionId) await get().load(run.sessionId, run.id);
    } catch (error) { if (get().detail?.run.id === run.id) set({ error: message(error) }); }
    finally { set({ isPublishing: false }); }
  },
}));
