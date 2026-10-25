import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { DeviceAuthService } from './DeviceAuthService';

export function createDeviceAuthService(transport: CommandTransport): DeviceAuthService {
  return {
    chatgptDeviceAuthCancel: (input) => transport.executeCommand('chatgpt_device_auth_cancel', input),
    chatgptDeviceAuthCheck: () => transport.executeCommand('chatgpt_device_auth_check'),
    chatgptDeviceAuthLogout: (input) => transport.executeCommand('chatgpt_device_auth_logout', input),
    chatgptDeviceAuthStart: () => transport.executeCommand('chatgpt_device_auth_start'),
    chatgptDeviceAuthStatus: () => transport.executeCommand('chatgpt_device_auth_status'),
  };
}
