import type { NotificationLevel } from './NotificationLevel';
import type { NotificationVariant } from './NotificationVariant';
import type { NotificationChannel } from './NotificationChannel';
import type { AppNotificationAction } from './AppNotificationAction';
import type { NotificationDismissPolicy } from './NotificationDismissPolicy';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  level: NotificationLevel;
  variant?: NotificationVariant;
  timestamp: number;
  isRead: boolean;
  channel?: NotificationChannel;
  actions?: AppNotificationAction[];
  clickAction?: AppNotificationAction;
  dismissPolicy?: NotificationDismissPolicy;
  autoDismissMs?: number;
}
