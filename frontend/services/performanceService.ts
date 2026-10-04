import { invoke, isTauri } from '@tauri-apps/api/core';

export interface PerformanceMetrics {
  cpuPercent: number | null;
  memoryBytes: number;
  processCount: number;
}

export async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  if (!isTauri()) {
    throw new Error('Performance monitoring is only available in the desktop app');
  }
  return invoke<PerformanceMetrics>('get_performance_metrics');
}
