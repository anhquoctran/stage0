import { getPlatformServices, installPlatformServices } from '../../../common/services/ipc/platformServices';
import type { ApplicationServices } from './ApplicationServices';
import { createApplicationServices } from './createApplicationServices';

let services: ApplicationServices | undefined;

export function getApplicationServices(): ApplicationServices {
  const platform = getPlatformServices();
  if (!services || services.platform !== platform) services = createApplicationServices(platform);
  return services;
}

/** Bootstrap/test seam. Install before mounting React or starting store workflows. */
export function installApplicationServices(runtime: ApplicationServices): void {
  if (services && services !== runtime) {
    throw new Error('Application services are already initialized. Install overrides before startup.');
  }
  installPlatformServices(runtime.platform);
  services = runtime;
}
