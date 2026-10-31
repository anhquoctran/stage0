import type { NotificationPermissionState } from '../../types/NotificationPermissionState';
import type { AppNotificationAction } from '../../types/AppNotificationAction';
import type { NotificationChannel } from '../../types/NotificationChannel';
import type { NotificationDismissPolicy } from '../../types/NotificationDismissPolicy';
import type { NotificationLevel } from '../../types/NotificationLevel';
import type { NotificationVariant } from '../../types/NotificationVariant';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface NotificationTransportService {
  dispatchNotification(input: {
    payload: {
      id: string;
      title: string;
      body: string;
      level: NotificationLevel;
      variant: NotificationVariant | undefined;
      channel: NotificationChannel | undefined;
      actions: AppNotificationAction[] | undefined;
      clickAction: AppNotificationAction | undefined;
      dismissPolicy: NotificationDismissPolicy | undefined;
      autoDismissMs: number | undefined;
    };
  }): Promise<unknown>;
  dispatchNotificationAction(input: {
    notificationId: string | undefined;
    action: AppNotificationAction;
  }): Promise<unknown>;
  sendTestNotification(): Promise<unknown>;
  setReady(input: { ready: boolean; generation: number }): Promise<void>;
  getPermission(): Promise<NotificationPermissionState>;
  requestPermission(): Promise<NotificationPermissionState>;
  openSettings(): Promise<void>;
}
