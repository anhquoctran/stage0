import type { PreferenceBootstrap } from '../features/preferences/types/PreferenceBootstrap';

declare global {
  interface Window {
    __STAGE0_PREFERENCES__?: PreferenceBootstrap;
    __STAGE0_PREFERENCES_REVISION__?: string;
    __STAGE0_PREFERENCES_PATH__?: string;
  }
}

export {};
