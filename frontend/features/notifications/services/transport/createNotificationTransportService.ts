import type { CommandTransport } from '../../../../common/services/ipc/contracts/CommandTransport';
import type { NotificationTransportService } from './NotificationTransportService';

export function createNotificationTransportService(transport: CommandTransport): NotificationTransportService {
  return {
    dispatchNotification: (input) => transport.executeCommand('dispatch_notification', input),
    dispatchNotificationAction: (input) => transport.executeCommand('dispatch_notification_action', input),
    notificationHostReady: () => transport.executeCommand('notification_host_ready'),
    sendTestNotification: () => transport.executeCommand('send_test_notification'),
    setNotificationHostVisibility: (input) => transport.executeCommand('set_notification_host_visibility', input),
  };
}
