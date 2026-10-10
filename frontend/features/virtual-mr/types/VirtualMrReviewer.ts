import type { ReviewerState } from './ReviewerState';

export interface VirtualMrReviewer {
  agentId: string;
  agentName: string;
  reviewStatus: ReviewerState;
  assignedAt: string;
}
