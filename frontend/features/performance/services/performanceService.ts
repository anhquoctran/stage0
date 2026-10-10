import { invoke, isTauri } from '@tauri-apps/api/core';
import type { PerformanceMetrics } from '../types/PerformanceMetrics';

export async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  if (!isTauri()) {
    throw new Error('Performance monitoring is only available in the desktop app');
  }
  return invoke<PerformanceMetrics>('get_performance_metrics');
}

export type { PerformanceMetrics } from '../types/PerformanceMetrics';
