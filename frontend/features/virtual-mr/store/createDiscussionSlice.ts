import { invoke } from '@tauri-apps/api/core';
import { type VirtualMrComment } from '../types/VirtualMrComment';
import { type VirtualMrDiscussion } from '../types/VirtualMrDiscussion';
import { type DbDiscussion } from '../types/DbDiscussion';
import { type DiscussionCodeSnippet } from '../types/DiscussionCodeSnippet';
import { type ReviewActionType } from '../types/ReviewActionType';
import { fromDbDiscussion } from '../utils/fromDbDiscussion';
import { AI_REVIEW_UNAVAILABLE } from '../../ai/constants/runtimeAvailability';
import type { VirtualMrState } from '../types/VirtualMrState';

export const createDiscussionSlice = (
  set: (partial: Partial<VirtualMrState> | ((state: VirtualMrState) => Partial<VirtualMrState>)) => void,
  get: () => VirtualMrState
) => ({
  createDiscussion: async (
    sessionId: string,
    payload: {
      filePath?: string | null;
      diffSide?: 'left' | 'right' | null;
      lineNumber?: number | null;
      commitId?: string | null;
      codeSnippet?: DiscussionCodeSnippet | null;
      initialComment: string;
      reviewAction?: ReviewActionType;
    }
  ) => {
    const { sessions } = get();
    const targetSession = sessions.find((s) => s.id === sessionId);
    if (!targetSession) throw new Error('The target MR is no longer available.');
    if (!payload.initialComment.trim()) throw new Error('A discussion cannot be empty.');

    const discId = `disc-${crypto.randomUUID()}`;
    const commentId = `comm-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const newComment: VirtualMrComment = {
      id: commentId,
      discussionId: discId,
      authorType: 'user',
      authorId: targetSession.assignee.email,
      authorName: targetSession.assignee.name,
      body: payload.initialComment,
      reviewAction: payload.reviewAction,
      createdAt: now,
      updatedAt: now,
    };

    const newDisc: VirtualMrDiscussion = {
      id: discId,
      sessionId,
      filePath: payload.filePath || null,
      diffSide: payload.diffSide || null,
      lineNumber: payload.lineNumber || null,
      commitId: payload.commitId || null,
      codeSnippet: payload.codeSnippet || null,
      isResolved: false,
      resolveType: 'manual',
      rootComment: newComment,
      children: [],
      createdAt: now,
    };

    try {
      await invoke('create_mr_discussion', {
        discussion: {
          id: newDisc.id,
          session_id: sessionId,
          file_path: newDisc.filePath,
          diff_side: newDisc.diffSide,
          line_number: newDisc.lineNumber,
          commit_id: newDisc.commitId,
          code_snippet: newDisc.codeSnippet,
          is_resolved: false,
          resolve_type: 'manual',
          resolved_by: null,
          resolved_at: null,
          verification_status: 'none',
          verified_by_bot: null,
          verified_at: null,
          created_at: now,
          comments: [],
        },
        firstComment: {
          id: newComment.id,
          discussion_id: discId,
          author_type: newComment.authorType,
          author_id: newComment.authorId,
          author_name: newComment.authorName,
          author_avatar: null,
          body: newComment.body,
          review_action: newComment.reviewAction || null,
          created_at: now,
          updated_at: now,
        },
      });
    } catch (e) {
      console.error('Failed to create discussion in db:', e);
      throw e;
    }
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              discussions: s.discussions.some((d) => d.id === discId)
                ? s.discussions
                : [...s.discussions, newDisc],
            }
          : s
      ),
    }));
    await get().invalidateReviewerApprovals(sessionId);
    void import('../../review/services/assignedReviewService')
      .then(({ reReviewAssignedSession }) => reReviewAssignedSession(sessionId))
      .catch((error) => console.warn('Could not re-review the new discussion:', error));
  },

  replyToDiscussion: async (
    discussionId: string,
    body: string,
    reviewAction?: VirtualMrComment['reviewAction'],
    authorType: VirtualMrComment['authorType'] = 'user',
    authorName?: string
  ) => {
    const { sessions } = get();
    const targetSession = sessions.find((s) => s.discussions.some((d) => d.id === discussionId));
    if (!targetSession) throw new Error('The target discussion is no longer available.');
    if (!body.trim()) throw new Error('A reply cannot be empty.');
    const commentId = `comm-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const newComm: VirtualMrComment = {
      id: commentId,
      discussionId,
      authorType,
      authorId: authorType === 'ai_agent' ? 'ai-bot' : targetSession.assignee.email,
      authorName: authorName || (authorType === 'ai_agent' ? 'Security Bot' : targetSession.assignee.name),
      body,
      reviewAction,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await invoke('add_mr_comment', {
        comment: {
          id: commentId,
          discussion_id: discussionId,
          author_type: authorType,
          author_id: newComm.authorId,
          author_name: newComm.authorName,
          author_avatar: null,
          body,
          review_action: reviewAction || null,
          created_at: now,
          updated_at: now,
        },
      });
    } catch (e) {
      console.error('Failed to add comment in db:', e);
      throw e;
    }
    set((state) => ({
      sessions: state.sessions.map((s) => ({
        ...s,
        discussions: s.discussions.map((d) =>
          d.id === discussionId
            ? {
                ...d,
                children: d.children.some((c) => c.id === commentId)
                  ? d.children
                  : [...d.children, newComm],
              }
            : d
        ),
      })),
    }));
    if (authorType === 'user') {
      await get().invalidateReviewerApprovals(targetSession.id);
      void import('../../review/services/assignedReviewService')
        .then(({ reReviewAssignedSession }) => reReviewAssignedSession(targetSession.id))
        .catch((error) => console.warn('Could not re-review the reply:', error));
    }
  },

  resolveDiscussion: async (
    discussionId: string,
    isResolved: boolean,
    resolveType: VirtualMrDiscussion['resolveType'] = 'manual'
  ) => {
    if (resolveType === 'ai_verified') throw new Error(AI_REVIEW_UNAVAILABLE);
    const { sessions } = get();
    const now = new Date().toISOString();

    const updated = sessions.map((s) => ({
      ...s,
      discussions: s.discussions.map((d) => {
        if (d.id !== discussionId) return d;
        return {
          ...d,
          isResolved,
          resolveType,
          resolvedBy: isResolved ? s.assignee.name : null,
          resolvedAt: isResolved ? now : null,
        };
      }),
    }));

    set({ sessions: updated });

    try {
      await invoke('resolve_mr_discussion', {
        discussionId,
        isResolved,
        resolveType,
        resolvedBy: isResolved ? 'Local User' : null,
      });
    } catch (e) {
      console.error('Failed to resolve discussion in db:', e);
    }
    const targetSessionId = sessions.find((session) =>
      session.discussions.some((discussion) => discussion.id === discussionId)
    )?.id;
    if (targetSessionId && !isResolved) await get().invalidateReviewerApprovals(targetSessionId);
    if (targetSessionId && isResolved) await get().tryResolveSession(targetSessionId);
  },

  reverifyDiscussionFix: async (discussionId: string) => {
    const session = get().sessions.find((item) =>
      item.discussions.some((discussion) => discussion.id === discussionId)
    );
    if (!session) return false;
    const { startAssignedReviewForSession } = await import(
      '../../review/services/assignedReviewService'
    );
    try {
      return Boolean(await startAssignedReviewForSession(session.id));
    } catch {
      return false;
    }
  },

  triggerIncrementalReReview: async (sessionId: string) => {
    const { reReviewAssignedSession } = await import(
      '../../review/services/assignedReviewService'
    );
    await reReviewAssignedSession(sessionId);
  },

  refreshDiscussions: async (sessionId: string) => {
    const repoId = get().currentRepoId;
    const items = await invoke<DbDiscussion[]>('list_mr_discussions', { sessionId });
    if (get().currentRepoId !== repoId) return;
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId
          ? { ...session, discussions: items.map(fromDbDiscussion) }
          : session
      ),
    }));
  },
});

