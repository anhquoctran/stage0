import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  AppNotification,
  AppNotificationAction,
  NotificationDispatchResult,
  NotificationPermissionState,
  NotifyOptions,
} from '../types/notification';
import { useNotificationStore } from '../store/useNotificationStore';
import { usePreferencesStore } from '../store/usePreferencesStore';

let isListening = false;
let unlistenFn: UnlistenFn | null = null;

export const notificationService = {
  /**
   * Initializes background notification event listener from backend (Tauri event: 'app-notification')
   */
  async init(): Promise<void> {
    if (isListening || !isTauri()) return;
    isListening = true;

    try {
      unlistenFn = await listen<Record<string, unknown>>('app-notification', (event) => {
        const payload = event.payload;
        const notification: AppNotification = {
          id: (payload.id as string) || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: (payload.title as string) || 'Stage0 Notification',
          body: (payload.body as string) || '',
          level: (payload.level as AppNotification['level']) || 'info',
          timestamp: Date.now(),
          isRead: false,
          actions: Array.isArray(payload.actions)
            ? (payload.actions as AppNotificationAction[])
            : undefined,
          autoDismissMs: typeof payload.auto_dismiss_ms === 'number' ? payload.auto_dismiss_ms : 6000,
        };

        // Record history only - no in-app floating banner
        useNotificationStore.getState().addNotification(notification);
      });
    } catch (err) {
      console.warn('[NotificationService] Failed to listen to backend notifications:', err);
    }
  },

  /**
   * Cleans up listeners on app unmount
   */
  destroy(): void {
    if (unlistenFn) {
      unlistenFn();
      unlistenFn = null;
    }
    isListening = false;
  },

  /**
   * On macOS this reflects Notification Center authorization. Windows and Linux
   * do not expose an equivalent per-app permission prompt through this backend.
   */
  async isPermissionGranted(): Promise<boolean> {
    const state = await this.getPermissionState();
    return state === 'granted' || state === 'not_required';
  },

  /**
   * Returns the OS notification permission state. Never consults browser
   * notification APIs: Stage0 dispatches native notifications only.
   */
  async getPermissionState(): Promise<NotificationPermissionState> {
    if (!isTauri()) return 'unsupported';
    try {
      return await invoke<NotificationPermissionState>('get_notification_permission_state');
    } catch (err) {
      console.warn('[NotificationService] getPermissionState error:', err);
      return 'unsupported';
    }
  },

  /**
   * Requests OS-native notification authorization when the platform requires it.
   */
  async requestPermission(): Promise<NotificationPermissionState> {
    if (!isTauri()) return 'unsupported';
    // Native failures must reach the UI; they are not a user denial of consent.
    return invoke<NotificationPermissionState>('request_notification_permission');
  },

  /**
   * Unified dispatch function for native push notifications:
   * - Shows native OS notification (Windows Toast, macOS Notification Center, Linux Freedesktop D-Bus)
   * - Stores event in notification history for auditing
   * - Does NOT show in-app toasts
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
      autoDismissMs: options.autoDismissMs,
    };

    // 1. Record in history
    try {
      useNotificationStore.getState().addNotification(notification);
    } catch (err) {
      console.warn('[NotificationService] Failed to record notification history:', err);
    }

    // 2. Native desktop notification (if enabled and not silent, or forceDesktop requested).
    const shouldDispatchDesktop = options.forceDesktop || (!options.silent && settings.enableDesktopNotifications);
    let delivery: NotificationDispatchResult['delivery'] = 'not_requested';
    let deliveryError: string | undefined;
    if (shouldDispatchDesktop) {
      if (!isTauri()) {
        delivery = 'unsupported';
      } else {
        try {
          await invoke('send_push_notification', {
            payload: {
              id: notification.id,
              title: notification.title,
              body: notification.body,
              level: notification.level,
              actions: notification.actions,
              auto_dismiss_ms: notification.autoDismissMs,
            },
          });
          delivery = 'sent';
        } catch (err) {
          delivery = 'failed';
          deliveryError = 'Native OS notification delivery failed.';
          console.warn('[NotificationService] Native OS notification delivery failed:', err);
        }
      }
    }

    return { notification, delivery, error: deliveryError };
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
