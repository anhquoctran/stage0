import type { DiscussionCodeSnippet } from './DiscussionCodeSnippet';

export interface DbDiscussion {
  id: string;
  session_id: string;
  file_path: string | null;
  diff_side: 'left' | 'right' | null;
  line_number: number | null;
  commit_id: string | null;
  code_snippet?: DiscussionCodeSnippet | null;
  content_hash: string | null;
  context_before: string | null;
  context_after: string | null;
  is_resolved: boolean;
  resolve_type: 'manual' | 'ai_verified';
  resolved_by: string | null;
  resolved_at: string | null;
  verification_status: 'none' | 'verifying' | 'pass' | 'fail' | 'outdated';
  verified_by_bot: string | null;
  verified_at: string | null;
  created_at: string;
  comments: Array<{ id: string; discussion_id: string; author_type: 'user' | 'ai_agent'; author_id: string; author_name: string; author_avatar: string | null; body: string; review_action: 'comment' | 'approve' | 'request_changes' | null; created_at: string; updated_at: string }>;
}
