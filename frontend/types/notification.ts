export type NotificationLevel = 'info' | 'success' | 'warning' | 'error' | 'update';

export interface AppNotificationAction {
  label: string;
  actionType: string;
  payload?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  level: NotificationLevel;
  timestamp: number;
  isRead: boolean;
  actions?: AppNotificationAction[];
  autoDismissMs?: number;
}

export interface NotifyOptions {
  title: string;
  body: string;
  level?: NotificationLevel;
  actions?: AppNotificationAction[];
  autoDismissMs?: number;
  silent?: boolean;
}
