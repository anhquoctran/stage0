export interface ReviewBatchProgress {
  current: number;
  total: number;
  completed: number;
  reviewerName: string;
  phase: 'preparing-description' | 'reviewing';
}

