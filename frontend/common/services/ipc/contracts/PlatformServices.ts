import type { CommandTransport } from './CommandTransport';
import type { EventService } from './EventService';
import type { PathService } from './PathService';
import type { PlatformCapabilities } from './PlatformCapabilities';
import type { WindowService } from './WindowService';

export interface PlatformServices {
  readonly commands: CommandTransport;
  readonly events: EventService;
  readonly paths: PathService;
  readonly windows: WindowService;
  readonly capabilities: PlatformCapabilities;
}
