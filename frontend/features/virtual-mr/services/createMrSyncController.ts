import type { StoreApi } from 'zustand';
import type { VirtualMrState } from '../types/VirtualMrState';
import type { MrSyncState } from '../types/MrSyncState';
import type { VirtualMrService } from './transport/VirtualMrService';
import type { GitHistoryService } from '../../git/services/transport/GitHistoryService';

/** One refresh at a time per window; background MRs receive metadata only. */
export function createMrSyncController(deps: {
  store: Pick<StoreApi<VirtualMrState>, 'getState' | 'setState'>;
  service: VirtualMrService;
  getCommits: GitHistoryService['getCommitsBetweenRefs'];
  refreshDiff: () => Promise<void>;
}) {
  let disposed = false;
  let busy = false;
  let dirty = false;
  let shown = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Map<string, MrSyncState>();
  const key = () => {
    const state = deps.store.getState();
    const session = state.sessions.find(s => s.id === state.activeSessionId);
    const sync = session?.sync;
    return !state.isDraftActive && sync?.refStatus === 'ready'
      ? `${state.currentRepoId}:${session!.id}:${sync.baseSha}:${sync.headSha}` : '';
  };
  const schedule = () => {
    if (disposed || key() === shown || !key()) return;
    dirty = true;
    if (!busy && !timer) timer = setTimeout(() => { timer = undefined; void refresh(); }, 100);
  };
  const refresh = async () => {
    if (busy || disposed) return;
    const state = deps.store.getState();
    const session = state.sessions.find(s => s.id === state.activeSessionId);
    const sync = session?.sync;
    if (!session || !sync?.baseSha || !sync.headSha || !state.currentRepoPath) return;
    const version = key();
    busy = true; dirty = false;
    try {
      const [commits] = await Promise.all([
        deps.getCommits({ repoPath: state.currentRepoPath, base: sync.baseSha, compare: sync.headSha }),
        deps.refreshDiff(),
      ]);
      const queued = pending.get(session.id);
      const stillCurrent = !queued || (queued.baseSha === sync.baseSha && queued.headSha === sync.headSha);
      if (!disposed && version === key() && stillCurrent) {
        shown = version;
        deps.store.setState(current => ({ sessions: current.sessions.map(s => s.id !== session.id ? s : {
          ...s, commits: commits.map(c => ({ hash: c.hash, shortHash: c.short_hash,
            subject: c.subject, body: c.body, authorName: c.author_name,
            authorEmail: c.author_email, authoredDate: c.authored_date })),
        }) }));
      }
    } catch (error) { console.warn('Could not refresh the current MR revision:', error); }
    finally { busy = false; if (dirty && !disposed) schedule(); }
  };
  const flush = () => {
    flushTimer = undefined;
    const byId = new Map(pending); pending.clear();
    deps.store.setState(state => {
      let changed = false;
      const sessions = state.sessions.map(session => {
      const sync = byId.get(session.id);
      if (!sync || sync.repoId !== state.currentRepoId || sync.revision <= (session.sync?.revision ?? -1)
        || sync.baseBranch !== session.baseBranch || sync.compareBranch !== session.compareBranch) return session;
      changed = true;
      return { ...session, sync, status: sync.sessionStatus,
        reviewers: session.reviewers.map(r => ({ ...r, reviewStatus: sync.reviewers[r.agentId] ?? r.reviewStatus })) };
      });
      return changed ? { sessions } : state;
    });
    schedule();
  };
  const receive = (updates: MrSyncState[]) => {
    if (disposed) return;
    const relevant = updates.filter(s => s.repoId === deps.store.getState().currentRepoId);
    if (!relevant.length) return;
    for (const sync of relevant) {
      if (sync.revision >= (pending.get(sync.sessionId)?.revision ?? -1)) pending.set(sync.sessionId, sync);
    }
    if (!flushTimer) flushTimer = setTimeout(flush, 40);
  };
  return {
    receive,
    selected: () => { if (!key()) shown = ''; schedule(); },
    hydrate: async (repoId: string, requestSync = false) => {
      const updates = await deps.service.readMrSync({ repoId, syncOnly: true, requestSync });
      if (!disposed && deps.store.getState().currentRepoId === repoId) receive(updates);
    },
    dispose: () => { disposed = true; if (timer) clearTimeout(timer); if (flushTimer) clearTimeout(flushTimer); pending.clear(); },
  };
}
