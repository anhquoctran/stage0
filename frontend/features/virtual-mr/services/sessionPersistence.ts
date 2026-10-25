import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

import type { VirtualMrSession } from '../types/VirtualMrSession';
import type { VirtualMrSessionSaveOutcome } from '../types/VirtualMrSessionSaveOutcome';

const pendingWrites = new Map<string, Promise<unknown>>();
const savedDuringQueue = new Map<string, VirtualMrSession>();

// Keep a session's mutations in click order, including removals and saves made
// by title/status/branch edits. A failed write must not block the next action.
export function enqueueSessionWrite<T>(sessionId: string, action: () => Promise<T>): Promise<T> {
  const previous = pendingWrites.get(sessionId) ?? Promise.resolve();
  const pending = previous.catch(() => undefined).then(action);
  pendingWrites.set(sessionId, pending);
  const cleanup = () => {
    if (pendingWrites.get(sessionId) === pending) {
      pendingWrites.delete(sessionId);
      savedDuringQueue.delete(sessionId);
    }
  };
  void pending.then(cleanup, cleanup);
  return pending;
}

export async function flushSessionWrites(): Promise<void> {
  await Promise.allSettled([...pendingWrites.values()]);
}

export function pendingSessionSnapshot(sessionId: string): VirtualMrSession | undefined {
  return savedDuringQueue.get(sessionId);
}

export async function saveSessionSnapshot(session: VirtualMrSession): Promise<VirtualMrSessionSaveOutcome> {
  const result = await getApplicationServices().virtualMrs.saveVirtualMrSession({
    session: {
      id: session.id,
      repo_id: session.repoId,
      title: session.title,
      description: session.description,
      base_branch: session.baseBranch,
      compare_branch: session.compareBranch,
      status: session.status,
      assignee_name: session.assignee.name,
      assignee_email: session.assignee.email,
      is_pinned: session.isPinned,
      sandbox_adapter_type: 'in_memory',
      sandbox_instance_id: null,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      label_ids: session.labels.map((label) => label.id),
      reviewers: session.reviewers.map((reviewer) => ({
        agent_id: reviewer.agentId,
        agent_name: reviewer.agentName,
        review_status: reviewer.reviewStatus,
        assigned_at: reviewer.assignedAt,
      })),
    },
  });
  if (result.outcome === 'saved') savedDuringQueue.set(session.id, session);
  return result;
}
