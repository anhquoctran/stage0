import type { PerformanceMetrics } from '../../types/PerformanceMetrics';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface PerformanceService {
  getPerformanceMetrics(): Promise<PerformanceMetrics>;
}
