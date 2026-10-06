export type NotificationVariant = 'default' | 'success' | 'warning' | 'danger';

/** Legacy levels remain accepted while existing call sites migrate to variants. */
export type NotificationLevel = NotificationVariant | 'info' | 'error' | 'update';

export type NotificationDismissPolicy = 'manual' | 'timeout' | 'both';

export type NotificationChannel = 'softwareUpdates' | 'aiReview' | 'gitSync' | 'guardrails';

export interface NotificationSettings {
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
  variant?: NotificationVariant;
  timestamp: number;
  isRead: boolean;
  channel?: NotificationChannel;
  actions?: AppNotificationAction[];
  clickAction?: AppNotificationAction;
  dismissPolicy?: NotificationDismissPolicy;
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
  variant?: NotificationVariant;
  channel: NotificationChannel;
  actions?: AppNotificationAction[];
  clickAction?: AppNotificationAction;
  dismissPolicy?: NotificationDismissPolicy;
  autoDismissMs?: number;
}
