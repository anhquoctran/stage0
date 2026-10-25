import type { PlatformServices } from '../../contracts/PlatformServices';
import { createBrowserPlatform } from '../browser/createBrowserPlatform';

/** Explicit fake ports; omitted native capabilities fail instead of guessing results. */
export function createTestPlatform(overrides: Partial<PlatformServices> = {}): PlatformServices {
  return { ...createBrowserPlatform(), ...overrides };
}
