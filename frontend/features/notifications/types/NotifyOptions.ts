import type { NotificationLevel } from './NotificationLevel';
import type { NotificationVariant } from './NotificationVariant';
import type { NotificationChannel } from './NotificationChannel';
import type { AppNotificationAction } from './AppNotificationAction';
import type { NotificationDismissPolicy } from './NotificationDismissPolicy';

export interface NotifyOptions {
  title: string;
  body: string;
  level?: NotificationLevel;
  variant?: NotificationVariant;
  channel: NotificationChannel;
  actions?: AppNotificationAction[];
  clickAction?: AppNotificationAction;
  dismissPolicy?: NotificationDismissPolicy;
  autoDismissMs?: number;
}
