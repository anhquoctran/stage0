import type { ChatGptDeviceAuthStatus } from './ChatGptDeviceAuthStatus';

export interface ChatGptDeviceAuthState {
  status: ChatGptDeviceAuthStatus | null;
  isActing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  start: () => Promise<void>;
  checkSaved: () => Promise<void>;
  cancel: () => Promise<void>;
  logout: () => Promise<void>;
}
