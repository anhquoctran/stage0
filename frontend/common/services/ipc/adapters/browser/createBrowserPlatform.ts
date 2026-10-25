import type { PlatformServices } from '../../contracts/PlatformServices';
import { UnsupportedCapabilityError } from '../../contracts/UnsupportedCapabilityError';

/** Feature owners retain their existing browser preferences/link/image fallbacks. */
export function createBrowserPlatform(): PlatformServices {
  const unavailable = (capability: string): never => { throw new UnsupportedCapabilityError(capability); };
  return {
    commands: {
      executeCommand: async () => unavailable('backend operations'),
      executeWithProgress: async () => unavailable('backend progress'),
    },
    events: { subscribe: async () => unavailable('application events') },
    paths: {
      homeDirectory: async () => unavailable('home directory'),
      isAbsolute: async () => unavailable('native path validation'),
      join: async () => unavailable('native path joining'),
    },
    windows: {
      current: () => unavailable('native windows'),
      currentMonitor: async () => unavailable('display monitors'),
    },
    capabilities: {
      backend: false, executableDiscovery: false, menuUpdates: false, events: false, windows: false, paths: false, keychain: false,
      externalAgents: false, notifications: false, preferencesFile: false,
      systemFonts: false, nativeMenu: false, attachments: false, externalLinks: false,
    },
  };
}
