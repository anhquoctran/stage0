import type { AppNotification } from './AppNotification';
import type { NotificationDeliveryState } from './NotificationDeliveryState';

export interface NotificationDispatchResult {
  notification: AppNotification;
  delivery: NotificationDeliveryState;
  error?: string;
}
