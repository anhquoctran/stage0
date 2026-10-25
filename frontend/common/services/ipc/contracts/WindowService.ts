import type { DisplayMonitor } from './DisplayMonitor';
import type { WindowHandle } from './WindowHandle';

export interface WindowService {
  current(): WindowHandle;
  currentMonitor(): Promise<DisplayMonitor | null>;
}
