import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { useGitStore } from '../../git/store/useGitStore';
import { useVirtualMrStore } from '../store/useVirtualMrStore';
import { animateCommentRemoval } from '../utils/animateCommentRemoval';

/** Persist first, animate the mounted content, then reconcile the owning store. */
export function useDiscussionDeletion(sessionId: string) {
  const { discussions } = useApplicationServices();
  const { t } = useTranslation();
  const gate = useRef(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const refresh = async () => {
    try {
      await useVirtualMrStore.getState().refreshDiscussions(sessionId);
    } catch (error) {
      console.warn('Could not refresh discussion permissions:', error);
    }
  };

  const remove = async (commentId: string, element: HTMLElement) => {
    if (gate.current) return;
    gate.current = true;
    setIsDeleting(true);
    try {
      const result = await discussions.deleteMrComment({ commentId });
      await animateCommentRemoval(element);
      useVirtualMrStore.setState((state) => ({
        sessions: state.sessions.map((session) => session.id !== sessionId ? session : {
          ...session,
          discussions: session.discussions
            .filter((item) => !(result.deletedDiscussion && item.id === result.discussionId))
            .map((item) => item.id !== result.discussionId ? item : {
              ...item,
              children: item.children.filter((comment) => comment.id !== commentId),
            }),
        }),
      }));
    } catch (error) {
      useGitStore.getState().showToast(t('virtualMr.discussion.deleteFailed', {
        error: error instanceof Error ? error.message : String(error),
      }), 'error');
    } finally {
      await refresh();
      gate.current = false;
      setIsDeleting(false);
    }
  };

  return { isDeleting, remove };
}
