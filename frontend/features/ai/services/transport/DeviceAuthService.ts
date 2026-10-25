import type { ChatGptDeviceAuthStatus } from '../../types/ChatGptDeviceAuthStatus';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface DeviceAuthService {
  chatgptDeviceAuthCancel(input: {
    attemptId: string;
  }): Promise<ChatGptDeviceAuthStatus>;
  chatgptDeviceAuthCheck(): Promise<ChatGptDeviceAuthStatus>;
  chatgptDeviceAuthLogout(input: {
    attemptId: string;
  }): Promise<ChatGptDeviceAuthStatus>;
  chatgptDeviceAuthStart(): Promise<ChatGptDeviceAuthStatus>;
  chatgptDeviceAuthStatus(): Promise<ChatGptDeviceAuthStatus>;
}
