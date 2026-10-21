import type { ReviewSnapshot } from './ReviewSnapshot';
import type { ReviewFinding } from './ReviewFinding';
import type { ReviewRetryState } from './ReviewRetryState';
import type { ReviewDecision } from './ReviewDecision';

export type { ReviewDecision } from './ReviewDecision';

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
  retry?: ReviewRetryState;
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
