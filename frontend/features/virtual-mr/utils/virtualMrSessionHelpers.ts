import { useGitStore } from '../../git/store/useGitStore';
import i18n from '../../i18n/i18n';
import { type VirtualMrSession } from '../types/VirtualMrSession';
import type { VirtualMrSessionSaveOutcome } from '../types/VirtualMrSessionSaveOutcome';
import { enqueueSessionWrite, pendingSessionSnapshot, saveSessionSnapshot } from '../services/sessionPersistence';
import type { VirtualMrState } from '../types/VirtualMrState';

export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error) || String(error);
  } catch {
    return String(error);
  }
};

export function openExistingVirtualMr(
  duplicate: Extract<VirtualMrSessionSaveOutcome, { outcome: 'duplicate_open' }>,
  get: () => VirtualMrState
): void {
  const state = get();
  const existing = state.sessions.find((session) => session.id === duplicate.existing_id);
  const sourceToTarget = `${duplicate.compare_branch} → ${duplicate.base_branch}`;

  if (existing) {
    state.switchSession(existing.id);
    void useGitStore.getState().setBranchComparison(existing.baseBranch, existing.compareBranch);
    useGitStore.getState().showToast(
      i18n.t('virtualMr.toasts.duplicateOpened', { sourceToTarget, title: existing.title }),
    );
    return;
  }

  useGitStore.getState().showToast(
    i18n.t('virtualMr.toasts.duplicateExists', { sourceToTarget, title: duplicate.existing_title }),
  );
}

export const persistSession = (
  session: VirtualMrSession,
  get: () => VirtualMrState
): Promise<VirtualMrSessionSaveOutcome> =>
  enqueueSessionWrite(session.id, () => {
    const current = get().sessions.find((item) => item.id === session.id);
    return saveSessionSnapshot(current ?? pendingSessionSnapshot(session.id) ?? session);
  });

export const updateSessionMetadata = async (
  sessionId: string,
  update: (session: VirtualMrSession) => Partial<Pick<VirtualMrSession, 'reviewers' | 'labels' | 'status'>> | null,
  get: () => VirtualMrState,
  set: (fn: (state: VirtualMrState) => Partial<VirtualMrState>) => void
): Promise<void> => {
  const original = get().sessions.find((item) => item.id === sessionId);
  if (!original) return;
  try {
    await enqueueSessionWrite(sessionId, async () => {
      const session = get().sessions.find((item) => item.id === sessionId)
        ?? pendingSessionSnapshot(sessionId) ?? original;
      const changes = update(session);
      if (!changes) return;
      const updatedAt = new Date().toISOString();
      const outcome = await saveSessionSnapshot({ ...session, ...changes, updatedAt });
      if (outcome.outcome === 'duplicate_open') {
        openExistingVirtualMr(outcome, get);
        return;
      }
      set((state) => ({
        sessions: state.sessions.map((item) => item.id === sessionId
          ? { ...item, ...changes, updatedAt }
          : item),
      }));
    });
  } catch (error) {
    console.error('Failed to save Virtual MR selections:', error);
    useGitStore.getState().showToast(i18n.t('virtualMr.toasts.reviewerLabelsSaveFailed'));
  }
};

