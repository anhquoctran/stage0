import type { ReviewRun } from './ReviewRun';
import type { ReviewRunDetail } from './ReviewRunDetail';
import type { AiConfig } from '../../ai/types/AiConfig';

export interface ReviewState {
  isOpen: boolean;
  sessionId: string | null;
  runs: ReviewRun[];
  detail: ReviewRunDetail | null;
  error: string | null;
  isStarting: boolean;
  isPublishing: boolean;
  activeRuns: Record<string, ReviewRun>;
  lastFinishedRun: ReviewRun | null;
  syncActive: () => Promise<void>;
  open: (sessionId: string) => void;
  close: () => void;
  load: (sessionId: string, runId?: string) => Promise<void>;
  start: (config: AiConfig, allowRemote: boolean, reviewer?: { id: string; name: string }) => Promise<void>;
  cancel: () => Promise<void>;
  publish: () => Promise<void>;
}
