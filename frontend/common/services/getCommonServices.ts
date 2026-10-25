import type { PlatformServices } from './ipc/contracts/PlatformServices';
import { getPlatformServices } from './ipc/platformServices';
import { createExternalLinkService } from './transport/createExternalLinkService';
import { createAttachmentStorageService } from './transport/createAttachmentStorageService';

const instances = new WeakMap<PlatformServices, ReturnType<typeof createCommonServices>>();

function createCommonServices(platform: PlatformServices) {
  return {
    externalLinks: createExternalLinkService(platform.commands),
    attachments: createAttachmentStorageService(platform.commands),
  };
}

export function getCommonServices(platform = getPlatformServices()) {
  let services = instances.get(platform);
  if (!services) {
    services = createCommonServices(platform);
    instances.set(platform, services);
  }
  return services;
}
