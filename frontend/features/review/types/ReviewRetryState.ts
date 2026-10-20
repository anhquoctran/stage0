export interface ReviewRetryState {
  reason: string;
  httpStatus: number | null;
  attempt: number;
  maxAttempts: number;
  retryAt: string;
}
