import { create } from 'zustand';
import type { WindowChrome } from '../types/WindowChrome';

export const useWindowChromeStore = create<{ profile: WindowChrome; ready: boolean }>(() => ({
  ready: false,
  profile: {
    platform: '', desktop: 'unknown', session: 'unknown', nativeFrame: false,
    controlsLeft: [], controlsRight: ['minimize', 'maximize', 'close'], doubleClickAction: 'maximize',
  },
}));
