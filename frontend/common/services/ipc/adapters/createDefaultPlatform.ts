import { isTauri } from '@tauri-apps/api/core';
import type { PlatformServices } from '../contracts/PlatformServices';
import { createBrowserPlatform } from './browser/createBrowserPlatform';
import { createTauriPlatform } from './tauri/createTauriPlatform';

/** Called by the application composition root, once per window runtime. */
export function createDefaultPlatform(): PlatformServices {
  return isTauri() ? createTauriPlatform() : createBrowserPlatform();
}
