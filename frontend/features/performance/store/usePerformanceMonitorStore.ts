import { create } from 'zustand';
import type { PerformanceMonitorState } from '../types/PerformanceMonitorState';

const STORAGE_KEY = 'stage0_performance_monitor_enabled';

function getInitialEnabledState(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export const usePerformanceMonitorStore = create<PerformanceMonitorState>((set, get) => ({
  isEnabled: getInitialEnabledState(),
  toggle: () => {
    const isEnabled = !get().isEnabled;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(isEnabled));
    } catch {
      // Keep the in-memory toggle usable if persistent storage is unavailable.
    }
    set({ isEnabled });
  },
}));
