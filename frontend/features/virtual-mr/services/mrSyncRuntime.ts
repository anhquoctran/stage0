import type { ApplicationServices } from '../../../core/services/runtime/ApplicationServices';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import type { MrSyncState } from '../types/MrSyncState';
import { createMrSyncController } from './createMrSyncController';

export function installMrSyncRuntime(services: ApplicationServices): () => void {
  if (!services.platform.capabilities.backend || !services.platform.capabilities.events) return () => {};
  const controller = createMrSyncController({ store: useVirtualMrStore,
    service: services.virtualMrs, getCommits: services.gitHistory.getCommitsBetweenRefs,
    refreshDiff: () => useGitStore.getState().refreshDiff() });
  let disposed = false;
  let ready = false;
  let stopEvents: (() => void) | undefined;
  let repo = '';
  let selection = '';
  let sessionList: unknown;
  let lastRequest = 0;
  let lastRequestedRepo = '';
  const hydrate = (id: string, refresh = false) => void controller.hydrate(id, refresh)
    .catch(error => console.warn('Could not load MR synchronization state:', error));
  const focus = () => {
    if (!ready || disposed) return;
    const id = useVirtualMrStore.getState().currentRepoId;
    if (!id || (id === lastRequestedRepo && Date.now() - lastRequest < 2000)) return;
    lastRequest = Date.now();
    lastRequestedRepo = id;
    hydrate(id, true);
  };
  const updateSelection = () => {
    if (!ready || disposed) return;
    const state = useVirtualMrStore.getState();
    if (state.isLoadingSessions) return;
    const listChanged = sessionList !== state.sessions;
    sessionList = state.sessions;
    const nextRepo = state.currentRepoId || '';
    if (repo !== nextRepo) { repo = nextRepo; if (repo) focus(); }
    else if (listChanged && repo && state.sessions.some(s => s.id === state.activeSessionId && !s.sync && s.status !== 'closed')) hydrate(repo);
    const next = `${repo}:${state.activeSessionId}:${state.isDraftActive}`;
    if (selection !== next || listChanged) { selection = next; controller.selected(); }
  };
  const stopStore = useVirtualMrStore.subscribe(updateSelection);
  void services.platform.events.subscribe<MrSyncState[]>('mr-sync-updated', updates => {
    if (!disposed) controller.receive(updates);
  }).then(stop => { if (disposed) stop(); else { stopEvents = stop; ready = true; updateSelection(); } })
    .catch(error => console.warn('Could not subscribe to MR synchronization:', error));
  window.addEventListener('focus', focus);
  const visible = () => { if (document.visibilityState === 'visible') focus(); };
  document.addEventListener('visibilitychange', visible);
  return () => { if (disposed) return; disposed = true; controller.dispose(); stopStore(); stopEvents?.();
    window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visible); };
}
