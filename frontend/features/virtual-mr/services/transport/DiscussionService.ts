import type { AuthorType } from '../../types/AuthorType';
import type { DbDiscussion } from '../../types/DbDiscussion';
import type { DiscussionCodeSnippet } from '../../types/DiscussionCodeSnippet';
import type { ReviewActionType } from '../../types/ReviewActionType';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface DiscussionService {
  addMrComment(input: {
    comment: {
      id: string;
      discussion_id: string;
      author_type: AuthorType;
      author_id: string;
      author_name: string;
      author_avatar: null;
      body: string;
      review_action: ReviewActionType | null;
      created_at: string;
      updated_at: string;
    };
  }): Promise<unknown>;
  createMrDiscussion(input: {
    discussion: {
      id: string;
      session_id: string;
      file_path: string | null | undefined;
      diff_side: "left" | "right" | null | undefined;
      line_number: number | null | undefined;
      commit_id: string | null | undefined;
      code_snippet: DiscussionCodeSnippet | null | undefined;
      is_resolved: boolean;
      resolve_type: string;
      resolved_by: null;
      resolved_at: null;
      verification_status: string;
      verified_by_bot: null;
      verified_at: null;
      created_at: string;
      comments: DbDiscussion['comments'];
    };
    firstComment: {
      id: string;
      discussion_id: string;
      author_type: AuthorType;
      author_id: string;
      author_name: string;
      author_avatar: null;
      body: string;
      review_action: ReviewActionType | null;
      created_at: string;
      updated_at: string;
    };
  }): Promise<unknown>;
  listMrDiscussions(input: {
    sessionId: string;
  }): Promise<DbDiscussion[]>;
  resolveMrDiscussion(input: {
    discussionId: string;
    isResolved: boolean;
    resolveType: "manual";
    resolvedBy: string | null;
  }): Promise<unknown>;
}
