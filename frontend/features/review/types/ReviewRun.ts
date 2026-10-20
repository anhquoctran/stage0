import type { ReviewSnapshot } from './ReviewSnapshot';
import type { ReviewFinding } from './ReviewFinding';

export type ReviewDecision = 'approve' | 'request_changes' | 'comment';

export interface ReviewRun {
  id: string;
  sessionId: string;
  provider: string;
  model: string;
  reviewerId?: string;
  reviewerName?: string;
  endpoint: string;
  snapshot: ReviewSnapshot;
  status: 'running' | 'completed' | 'partial' | 'incomplete' | 'failed' | 'cancelled' | 'interrupted';
  summary: string;
  decision: ReviewDecision | null;
  generatedDescription?: string;
  error: string | null;
  findings: ReviewFinding[];
  inspectedFiles: string[];
  turns: number;
  toolCalls: number;
  usageTokens: number;
  contextBytes: number;
  startedAt: string;
  finishedAt: string | null;
  published: boolean;
  promptVersion: string;
}
