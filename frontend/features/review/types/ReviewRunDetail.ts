import type { ReviewRun } from './ReviewRun';

export interface ReviewRunDetail {
  run: ReviewRun;
  events: Array<{ seq: number; kind: string; detail: Record<string, unknown>; createdAt: string }>;
}
