import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { ReviewState } from '../types/ReviewState';
import type { ReviewRun } from '../types/ReviewRun';
import type { ReviewRunDetail } from '../types/ReviewRunDetail';
import { useVirtualMrStore } from '../../virtual-mr/store/useVirtualMrStore';

let loadVersion = 0;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export const useReviewStore = create<ReviewState>((set, get) => ({
  isOpen: false, sessionId: null, runs: [], detail: null, error: null,
  isStarting: false, isPublishing: false,
  activeRuns: {},
  lastFinishedRun: null,
  syncActive: async () => {
    await Promise.all(Object.keys(get().activeRuns).map(async (id) => {
      try {
        const detail = await invoke<ReviewRunDetail>('get_ai_review', { runId: id });
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
  start: async (config, allowRemote, reviewer) => {
    const sessionId = get().sessionId;
    if (!sessionId || get().isStarting) return;
    set({ isStarting: true, error: null });
    try {
      const run = await invoke<ReviewRun>('start_ai_review', { request: {
        sessionId, provider: config.provider, authMode: config.authMode || 'api_key',
        model: config.model, baseUrl: config.baseUrl, instructions: config.systemPrompt, allowRemote,
        reasoningEffort: config.reasoningEffort || null, fastMode: config.fastMode === true,
        reviewerId: reviewer?.id || null, reviewerName: reviewer?.name || null,
      } });
      set((state) => ({ activeRuns: { ...state.activeRuns, [run.id]: run } }));
      if (get().sessionId === sessionId) {
        loadVersion++;
        set({ detail: { run, events: [] }, runs: [run, ...get().runs.filter((item) => item.id !== run.id)] });
      }
    } catch (error) { if (get().sessionId === sessionId) set({ error: message(error) }); }
    finally { set({ isStarting: false }); }
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
