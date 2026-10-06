import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  AppNotification,
  AppNotificationAction,
  NotificationDispatchResult,
  NotifyOptions,
} from '../types/notification';
import { useNotificationStore } from '../store/useNotificationStore';
import { usePreferencesStore } from '../store/usePreferencesStore';

let isListening = false;
let unlistenFns: UnlistenFn[] = [];

export const notificationService = {
  /**
   * Initializes the shared notification history and action listeners.
   */
  async init(): Promise<void> {
    if (isListening || !isTauri()) return;
    isListening = true;

    try {
      const stopNotifications = await listen<Record<string, unknown>>('app-notification', (event) => {
        const payload = event.payload;
        const level = (payload.level as AppNotification['level']) || 'info';
        const notification: AppNotification = {
          id: (payload.id as string) || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: (payload.title as string) || 'Stage0 Notification',
          body: (payload.body as string) || '',
          level,
          variant: (payload.variant as AppNotification['variant']) || this.variantForLevel(level),
          timestamp: Date.now(),
          isRead: false,
          channel: (payload.channel as AppNotification['channel']) || undefined,
          actions: Array.isArray(payload.actions)
            ? (payload.actions as AppNotificationAction[])
            : undefined,
          clickAction: (payload.clickAction || payload.click_action) as AppNotificationAction | undefined,
          dismissPolicy: (payload.dismissPolicy || payload.dismiss_policy) as AppNotification['dismissPolicy'] || 'both',
          autoDismissMs:
            typeof payload.autoDismissMs === 'number'
              ? payload.autoDismissMs
              : typeof payload.auto_dismiss_ms === 'number'
                ? payload.auto_dismiss_ms
                : 6000,
        };

        // Main windows keep the shared unread history; the notification host
        // receives a separate event for its transient toast queue.
        useNotificationStore.getState().addNotification(notification);
      });
      try {
        const stopActions = await listen<{
          notificationId?: string;
          action: AppNotificationAction;
        }>('notification-action', (event) => {
          this.handleAction(event.payload.action, event.payload.notificationId);
        });
        unlistenFns = [stopNotifications, stopActions];
      } catch (error) {
        stopNotifications();
        throw error;
      }
    } catch (err) {
      isListening = false;
      console.warn('[NotificationService] Failed to listen to backend notifications:', err);
    }
  },

  /**
   * Cleans up listeners on app unmount
   */
  destroy(): void {
    unlistenFns.forEach((unlisten) => unlisten());
    unlistenFns = [];
    isListening = false;
  },

  /**
   * Dispatches a Stage0 notification using the current platform's presentation:
   * - Custom Stage0 toast window on Windows and macOS
   * - Freedesktop notification service on Linux, which chooses placement
   * - Stores event in notification history for auditing
   * - Guaranteed never to throw an unhandled exception
   */
  async notify(options: NotifyOptions): Promise<NotificationDispatchResult> {
    const settings = useNotificationStore.getState().settings;

    // Check if channel is disabled
    if (options.channel && settings.channels[options.channel] === false) {
      return {
        notification: {
          id: `notif_skipped_${Date.now()}`,
          title: options.title,
          body: options.body,
          level: options.level || 'info',
          timestamp: Date.now(),
          isRead: true,
          channel: options.channel,
        },
        delivery: 'not_requested',
      };
    }

    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const notification: AppNotification = {
      id,
      title: options.title,
      body: options.body,
      level: options.level || 'info',
      timestamp: Date.now(),
      isRead: false,
      channel: options.channel,
      actions: options.actions,
      clickAction: options.clickAction,
      variant: options.variant || this.variantForLevel(options.level),
      dismissPolicy: options.dismissPolicy || 'both',
      autoDismissMs: options.autoDismissMs && options.autoDismissMs > 0 ? options.autoDismissMs : 6000,
    };

    // 1. Record in history
    try {
      useNotificationStore.getState().addNotification(notification);
    } catch (err) {
      console.warn('[NotificationService] Failed to record notification history:', err);
    }

    // A category preference is the only end-user delivery control.
    const shouldDispatch = settings.channels[options.channel];
    let delivery: NotificationDispatchResult['delivery'] = 'not_requested';
    let deliveryError: string | undefined;
    if (shouldDispatch) {
      if (!isTauri()) {
        delivery = 'unsupported';
      } else {
        try {
          await invoke('dispatch_notification', {
            payload: {
              id: notification.id,
              title: notification.title,
              body: notification.body,
              level: notification.level,
              variant: notification.variant,
              channel: notification.channel,
              actions: notification.actions,
              clickAction: notification.clickAction,
              dismissPolicy: notification.dismissPolicy,
              autoDismissMs: notification.autoDismissMs,
            },
          });
          delivery = 'sent';
        } catch (err) {
          delivery = 'failed';
          deliveryError = 'Stage0 notification delivery failed.';
          console.warn('[NotificationService] Stage0 notification delivery failed:', err);
        }
      }
    }

    return { notification, delivery, error: deliveryError };
  },

  variantForLevel(level?: AppNotification['level']): NonNullable<AppNotification['variant']> {
    switch (level) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'danger':
      case 'error':
        return 'danger';
      default:
        return 'default';
    }
  },

  async dispatchAction(action: AppNotificationAction, notificationId?: string): Promise<void> {
    if (!isTauri()) {
      this.handleAction(action, notificationId);
      return;
    }
    try {
      await invoke('dispatch_notification_action', { notificationId, action });
    } catch (error) {
      console.warn('[NotificationService] Could not route notification action:', error);
    }
  },

  /**
   * Handles user clicking an action button on a notification.
   */
  handleAction(action: AppNotificationAction, notificationId?: string): void {
    if (notificationId) {
      useNotificationStore.getState().markAsRead(notificationId);
      useNotificationStore.getState().dismissToast(notificationId);
    }

    switch (action.actionType) {
      case 'open_preferences_updates':
      case 'open_updates':
        usePreferencesStore.getState().openPreferences('updates');
        break;
      case 'open_preferences':
        usePreferencesStore.getState().openPreferences(action.payload || undefined);
        break;
      case 'open_url':
        if (action.payload) {
          window.open(action.payload, '_blank');
        }
        break;
      default:
        console.log('[NotificationService] Unhandled action type:', action.actionType, action.payload);
        break;
    }
  },
};
