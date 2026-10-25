import type { PlatformServices } from './contracts/PlatformServices';
import { createDefaultPlatform } from './adapters/createDefaultPlatform';

let platform: PlatformServices | undefined;

export function getPlatformServices(): PlatformServices {
  return platform ??= createDefaultPlatform();
}

/** Install before application startup; each window owns its own module instance. */
export function installPlatformServices(services: PlatformServices): void {
  if (platform && platform !== services) {
    throw new Error('Platform services are already initialized. Install overrides before startup.');
  }
  platform = services;
}
