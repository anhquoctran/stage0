import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  isPermissionGranted as tauriIsPermissionGranted,
  requestPermission as tauriRequestPermission,
} from '@tauri-apps/plugin-notification';
import { AppNotification, AppNotificationAction, NotifyOptions } from '../types/notification';
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
   * Checks if notification permission is granted on Windows, macOS, Linux, or Web.
   */
  async isPermissionGranted(): Promise<boolean> {
    if (isTauri()) {
      try {
        return await tauriIsPermissionGranted();
      } catch {
        return await invoke<boolean>('is_notification_permission_granted').catch(() => false);
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }

    return false;
  },

  /**
   * Requests OS desktop notification permission from user.
   */
  async requestPermission(): Promise<boolean> {
    if (isTauri()) {
      try {
        const res = await tauriRequestPermission();
        return res === 'granted';
      } catch {
        return await invoke<boolean>('request_notification_permission').catch(() => false);
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        return res === 'granted';
      } catch {
        return false;
      }
    }

    return false;
  },

  /**
   * Unified dispatch function for push notifications.
   * - Shows native OS notification (Windows Toast, macOS Notification Center, Linux Freedesktop DBus)
   * - Renders in-app toast floating banner
   * - Stores in notification history
   */
  async notify(options: NotifyOptions): Promise<AppNotification> {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const notification: AppNotification = {
      id,
      title: options.title,
      body: options.body,
      level: options.level || 'info',
      timestamp: Date.now(),
      isRead: false,
      actions: options.actions,
      autoDismissMs: options.autoDismissMs ?? 6000,
    };

    // 1. In-app toast and persistent history
    useNotificationStore.getState().addNotification(notification);

    // 2. Cross-platform OS Native Desktop Notification (unless silent)
    if (!options.silent) {
      if (isTauri()) {
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
        } catch (err) {
          console.debug('[NotificationService] Native push notification failed:', err);
        }
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification(options.title, {
              body: options.body,
              icon: '/icons/128x128.png',
            });
          } catch {}
        }
      }
    }

    return notification;
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
