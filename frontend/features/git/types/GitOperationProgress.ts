export interface GitOperationProgress {
  phase: string;
  percent: number | null;
  message: string;
}
