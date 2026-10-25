import type { WindowControlAction } from './WindowControlAction';

export interface WindowChrome {
  platform: string;
  desktop: 'gnome' | 'kde' | 'xfce' | 'unknown';
  session: 'wayland' | 'x11' | 'unknown';
  nativeFrame: boolean;
  controlsLeft: WindowControlAction[];
  controlsRight: WindowControlAction[];
  doubleClickAction: 'maximize' | 'minimize' | 'none';
}
