import { localizePlatformMessages } from '../../localizePlatformMessages';
import type { PlatformServices } from '../../contracts/PlatformServices';
import { createTauriCommands } from './commands';
import { createTauriEvents } from './events';
import { createTauriPaths } from './paths';
import { createTauriWindows } from './windows';

/** Construction is inert: no window handles, channels, subscriptions or IPC. */
export function createTauriPlatform(): PlatformServices {
  return localizePlatformMessages({
    commands: createTauriCommands(),
    events: createTauriEvents(),
    paths: createTauriPaths(),
    windows: createTauriWindows(),
    capabilities: {
      // Preserve the two existing bridge-readiness guards without exposing
      // native global names to feature code. No SDK calls are made here.
      get executableDiscovery() {
        return typeof window !== 'undefined' && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
      },
      get menuUpdates() {
        return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      },
      backend: true, events: true, windows: true, paths: true, keychain: true,
      externalAgents: true, notifications: true, preferencesFile: true,
      systemFonts: true, nativeMenu: true, attachments: true, externalLinks: true,
    },
  });
}
