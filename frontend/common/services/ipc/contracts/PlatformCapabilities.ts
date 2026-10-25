/** Availability only; backend permissions and guardrails remain authoritative. */
export interface PlatformCapabilities {
  readonly backend: boolean;
  readonly executableDiscovery: boolean;
  readonly menuUpdates: boolean;
  readonly events: boolean;
  readonly windows: boolean;
  readonly paths: boolean;
  readonly keychain: boolean;
  readonly externalAgents: boolean;
  readonly notifications: boolean;
  readonly preferencesFile: boolean;
  readonly systemFonts: boolean;
  readonly nativeMenu: boolean;
  readonly attachments: boolean;
  readonly externalLinks: boolean;
}
