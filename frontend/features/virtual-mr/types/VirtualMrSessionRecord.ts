import type { VirtualMrReviewerRecord } from './VirtualMrReviewerRecord';

export interface VirtualMrSessionRecord {
  id: string;
  repo_id: string;
  title: string;
  description: string | null;
  base_branch: string;
  compare_branch: string;
  status: string;
  assignee_name: string | null;
  assignee_email: string | null;
  is_pinned: boolean;
  sandbox_adapter_type: string;
  sandbox_instance_id: string | null;
  created_at: string;
  updated_at: string;
  label_ids: string[];
  reviewers: VirtualMrReviewerRecord[];
}
