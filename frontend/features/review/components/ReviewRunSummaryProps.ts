import type { ReviewRun } from '../types/ReviewRun';
export interface ReviewRunSummaryProps {
  run: ReviewRun;
  isPublishing: boolean;
  publish: () => Promise<void>;
}
