import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

import type { PerformanceMetrics } from '../types/PerformanceMetrics';

export async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  if (!getApplicationServices().platform.capabilities.backend) {
    throw new Error('Performance monitoring is only available in the desktop app');
  }
  return getApplicationServices().performance.getPerformanceMetrics();
}

export type { PerformanceMetrics } from '../types/PerformanceMetrics';
