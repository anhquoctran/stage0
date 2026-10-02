export type NotificationLevel = 'info' | 'success' | 'warning' | 'error' | 'update';

export type NotificationChannel = 'softwareUpdates' | 'aiReview' | 'gitSync' | 'guardrails';

export type NotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'not_required'
  | 'unsupported';

export interface NotificationSettings {
  enableDesktopNotifications: boolean;
  enableInAppToasts?: boolean;
  playAlertSound?: boolean;
  toastDurationMs?: number;
  channels: {
    softwareUpdates: boolean;
    aiReview: boolean;
    gitSync: boolean;
    guardrails: boolean;
  };
}

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
  channel?: NotificationChannel;
  actions?: AppNotificationAction[];
  autoDismissMs?: number;
}

export type NotificationDeliveryState = 'sent' | 'not_requested' | 'unsupported' | 'failed';

export interface NotificationDispatchResult {
  notification: AppNotification;
  delivery: NotificationDeliveryState;
  error?: string;
}

export interface NotifyOptions {
  title: string;
  body: string;
  level?: NotificationLevel;
  channel?: NotificationChannel;
  actions?: AppNotificationAction[];
  autoDismissMs?: number;
  silent?: boolean;
  forceDesktop?: boolean;
}
