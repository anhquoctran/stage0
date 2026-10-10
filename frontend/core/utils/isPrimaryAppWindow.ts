import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function isPrimaryAppWindow(): boolean {
  if (!isTauri()) return true;
  try {
    return getCurrentWindow().label === 'main';
  } catch {
    return false;
  }
}
