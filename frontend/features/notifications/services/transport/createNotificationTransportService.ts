import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { NotificationTransportService } from './NotificationTransportService';

export function createNotificationTransportService(transport: CommandTransport): NotificationTransportService {
  return {
    dispatchNotification: (input) => transport.executeCommand('dispatch_notification', input),
    dispatchNotificationAction: (input) => transport.executeCommand('dispatch_notification_action', input),
    sendTestNotification: () => transport.executeCommand('send_test_notification'),
    setReady: (input) => transport.executeCommand('set_notification_service_ready', input),
    getPermission: () => transport.executeCommand('get_notification_permission'),
    requestPermission: () => transport.executeCommand('request_notification_permission'),
    openSettings: () => transport.executeCommand('open_notification_settings'),
  };
}
