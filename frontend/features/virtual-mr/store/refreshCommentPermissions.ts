import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import type { VirtualMrState } from '../types/VirtualMrState';

/** Refresh permission hints without replacing content posted during this request. */
export async function refreshCommentPermissions(
  sessionId: string,
  set: (update: (state: VirtualMrState) => Partial<VirtualMrState>) => void,
  get: () => VirtualMrState,
) {
  const repoId = get().currentRepoId;
  try {
    const items = await getApplicationServices().discussions.listMrDiscussions({ sessionId });
    if (get().currentRepoId !== repoId) return;
    const allowed = new Set(items.flatMap((item) => item.comments
      .filter((comment) => comment.can_delete === true).map((comment) => comment.id)));
    set((state) => ({
      sessions: state.sessions.map((session) => session.id !== sessionId ? session : {
        ...session,
        discussions: session.discussions.map((discussion) => ({
          ...discussion,
          rootComment: discussion.rootComment && {
            ...discussion.rootComment, canDelete: allowed.has(discussion.rootComment.id),
          },
          children: discussion.children.map((comment) => ({ ...comment, canDelete: allowed.has(comment.id) })),
        })),
      }),
    }));
  } catch (error) {
    console.warn('Could not refresh comment permissions:', error);
  }
}
