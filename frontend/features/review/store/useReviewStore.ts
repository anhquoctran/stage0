import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ReviewState } from '../types/ReviewState';
import type { ReviewRun } from '../types/ReviewRun';
import type { ReviewRunDetail } from '../types/ReviewRunDetail';
import type { ReviewBotConfig } from '../types/ReviewBotConfig';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';

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
        const detail = await invoke<ReviewRunDetail>('get_ai_review', { runId: id });
        const finished = detail.run.status !== 'running' && Boolean(get().activeRuns[id]);
        set((state) => {
          if (!state.activeRuns[id]) return state;
          const activeRuns = { ...state.activeRuns };
          if (detail.run.status === 'running') activeRuns[id] = detail.run; else delete activeRuns[id];
          return { activeRuns,
            ...(detail.run.status !== 'running' ? { lastFinishedRun: detail.run } : {}),
            ...(state.detail?.run.id === id ? { detail } : {}),
            ...(state.sessionId === detail.run.sessionId ? { runs: state.runs.map((run) => run.id === id ? detail.run : run) } : {}),
          };
        });
        if (finished) {
          await useVirtualMrStore.getState().refreshDiscussions(detail.run.sessionId);
          if (detail.run.reviewerId) {
            const reviewerStatus = detail.run.status === 'completed' && detail.run.decision === 'approve'
              ? 'approved'
              : detail.run.decision === 'request_changes' || detail.run.findings.length > 0
                ? 'changes_requested'
                : ['completed', 'partial'].includes(detail.run.status)
                  ? 'commented'
                  : 'pending';
            await useVirtualMrStore.getState().setReviewerReviewStatus(
              detail.run.sessionId,
              detail.run.reviewerId,
              reviewerStatus,
            );
          }
          if (detail.run.reviewerId) {
            await useVirtualMrStore.getState().tryResolveSession(detail.run.sessionId);
          }
          const { flushQueuedReReviewAfterActive } = await import('../services/assignedReviewService');
          void flushQueuedReReviewAfterActive(detail.run.sessionId);
        }
      } catch (error) { if (get().isOpen) set({ error: message(error) }); }
    }));
  },
  open: (sessionId) => {
    loadVersion++;
    set({ isOpen: true, sessionId, runs: [], detail: null, error: null });
  },
  close: () => { loadVersion++; set({ isOpen: false }); },
  load: async (sessionId, runId) => {
    const version = ++loadVersion;
    try {
      const runs = await invoke<ReviewRun[]>('list_ai_reviews', { sessionId });
      const selected = runId || (get().detail?.run.sessionId === sessionId ? get().detail?.run.id : undefined) || runs[0]?.id;
      const detail = selected ? await invoke<ReviewRunDetail>('get_ai_review', { runId: selected }) : null;
      if (version === loadVersion && get().sessionId === sessionId) {
        const activeRuns = { ...get().activeRuns };
        for (const run of runs) { if (run.status === 'running') activeRuns[run.id] = run; else delete activeRuns[run.id]; }
        set({ runs, detail, activeRuns, error: null });
      }
    } catch (error) {
      if (version === loadVersion && get().sessionId === sessionId) set({ error: message(error) });
    }
  },
  start: async (config: ReviewBotConfig, allowRemote, reviewer) => {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    try { await get().startForSession(sessionId, config, allowRemote, reviewer); }
    catch { /* The store records the error for the open review panel. */ }
  },
  startForSession: async (sessionId, config, allowRemote, reviewer, generateDescription = false) => {
    if (startingSessionIds.has(sessionId) || Object.values(get().activeRuns).some((run) => run.sessionId === sessionId && run.status === 'running')) return null;
    startingSessionIds.add(sessionId);
    set({ isStarting: true, error: null });
    try {
      const run = await invoke<ReviewRun>('start_ai_review', { request: {
        sessionId, provider: config.provider, authMode: 'api_key',
        model: config.model, baseUrl: config.baseUrl, reviewerRole: config.reviewerRole,
        instructions: config.customInstructions, allowRemote,
        executionMode: config.executionMode || 'provider', acpAgent: config.acpAgent || null,
        reasoningEffort: config.reasoningEffort || null, fastMode: config.fastMode === true,
        reviewerId: reviewer?.id || null, reviewerName: reviewer?.name || null,
        generateDescription,
      } });
      set((state) => ({ activeRuns: { ...state.activeRuns, [run.id]: run } }));
      if (run.reviewerId) {
        await useVirtualMrStore.getState().setReviewerReviewStatus(sessionId, run.reviewerId, 'reviewing');
      }
      if (get().isOpen && get().sessionId === sessionId) {
        loadVersion++;
        set({ detail: { run, events: [] }, runs: [run, ...get().runs.filter((item) => item.id !== run.id)] });
      }
      return run;
    } catch (error) {
      if (get().isOpen && get().sessionId === sessionId) set({ error: message(error) });
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
    try { await invoke('cancel_ai_review', { runId: run.id }); }
    catch (error) { if (get().detail?.run.id === run.id) set({ error: message(error) }); }
  },
  publish: async () => {
    const run = get().detail?.run;
    if (!run || get().isPublishing || !['completed', 'partial'].includes(run.status)) return;
    set({ isPublishing: true, error: null });
    try {
      await invoke('publish_ai_review', { runId: run.id });
      await useVirtualMrStore.getState().refreshDiscussions(run.sessionId);
      if (get().isOpen && get().sessionId === run.sessionId) await get().load(run.sessionId, run.id);
    } catch (error) { if (get().detail?.run.id === run.id) set({ error: message(error) }); }
    finally { set({ isPublishing: false }); }
  },
}));
