import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  isPermissionGranted as tauriIsPermissionGranted,
  requestPermission as tauriRequestPermission,
} from '@tauri-apps/plugin-notification';
import {
  AppNotification,
  AppNotificationAction,
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
   * Checks if notification permission is currently granted on Windows, macOS, Linux, or Web.
   * Guaranteed never to throw an unhandled exception.
   */
  async isPermissionGranted(): Promise<boolean> {
    try {
      if (isTauri()) {
        try {
          const res = await invoke<boolean>('is_notification_permission_granted');
          if (typeof res === 'boolean') return res;
        } catch {}

        try {
          return await tauriIsPermissionGranted();
        } catch {
          return false;
        }
      }

      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
        return window.Notification.permission === 'granted';
      }
    } catch (err) {
      console.warn('[NotificationService] isPermissionGranted check failed:', err);
    }

    return false;
  },

  /**
   * Returns fine-grained OS notification permission state:
   * 'granted' | 'denied' | 'default' | 'unsupported'
   */
  async getPermissionState(): Promise<NotificationPermissionState> {
    try {
      if (isTauri()) {
        try {
          const granted = await invoke<boolean>('is_notification_permission_granted');
          return granted ? 'granted' : 'default';
        } catch {
          return 'default';
        }
      }

      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
        const perm = window.Notification.permission;
        if (perm === 'granted' || perm === 'denied' || perm === 'default') {
          return perm;
        }
      }

      return 'unsupported';
    } catch (err) {
      console.warn('[NotificationService] getPermissionState error:', err);
      return 'unsupported';
    }
  },

  /**
   * Requests OS desktop notification permission from user.
   * Handles user grant, user rejection ('denied'), dismissal ('default'),
   * or system policy blocks without throwing exceptions.
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (isTauri()) {
        try {
          const res = await invoke<boolean>('request_notification_permission');
          if (typeof res === 'boolean') return res;
        } catch (err) {
          console.warn('[NotificationService] Backend request_notification_permission failed:', err);
        }

        try {
          const res = await tauriRequestPermission();
          return res === 'granted';
        } catch {
          return false;
        }
      }

      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
        if (window.Notification.permission === 'denied') {
          // If already blocked by user, do not throw or re-prompt
          return false;
        }

        try {
          let res: NotificationPermission;
          const req = window.Notification.requestPermission();
          if (req && typeof req.then === 'function') {
            res = await req;
          } else {
            // Older browser callback compatibility
            res = await new Promise<NotificationPermission>((resolve) => {
              try {
                window.Notification.requestPermission((status) => resolve(status));
              } catch {
                resolve('denied');
              }
            });
          }
          return res === 'granted';
        } catch (err) {
          console.warn('[NotificationService] Notification.requestPermission() threw:', err);
          return false;
        }
      }
    } catch (err) {
      console.warn('[NotificationService] Uncaught error in requestPermission:', err);
    }

    return false;
  },

  /**
   * Unified dispatch function for native push notifications:
   * - Shows native OS notification (Windows WinRT / PowerShell Toast, macOS Notification Center, Linux Freedesktop DBus, or Web browser Notification)
   * - Stores event in notification history for auditing
   * - Does NOT show in-app toasts
   * - Guaranteed never to throw an unhandled exception
   */
  async notify(options: NotifyOptions): Promise<AppNotification> {
    const settings = useNotificationStore.getState().settings;

    // Check if channel is disabled
    if (options.channel && settings.channels[options.channel] === false) {
      return {
        id: `notif_skipped`,
        title: options.title,
        body: options.body,
        level: options.level || 'info',
        timestamp: Date.now(),
        isRead: true,
        channel: options.channel,
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

    // 2. Cross-platform OS Native Desktop Notification (if enabled and not silent, or forceDesktop requested)
    const shouldDispatchDesktop = options.forceDesktop || (!options.silent && settings.enableDesktopNotifications);
    if (shouldDispatchDesktop) {
      try {
        if (isTauri()) {
          await invoke('send_push_notification', {
            payload: {
              id: notification.id,
              title: notification.title,
              body: notification.body,
              level: notification.level,
              actions: notification.actions,
              auto_dismiss_ms: notification.autoDismissMs,
            },
          }).catch((err) => {
            console.debug('[NotificationService] Native push notification failed:', err);
          });
        } else if (typeof window !== 'undefined' && 'Notification' in window && window.Notification) {
          if (window.Notification.permission === 'granted') {
            try {
              const nativeNotif = new window.Notification(options.title, {
                body: options.body,
                icon: '/app-icon.svg',
              });

              if (options.actions && options.actions.length > 0) {
                nativeNotif.onclick = () => {
                  try {
                    window.focus();
                    notificationService.handleAction(options.actions![0], notification.id);
                  } catch {}
                };
              }
            } catch (err) {
              console.debug('[NotificationService] Native web Notification failed:', err);
            }
          }
        }
      } catch (err) {
        console.warn('[NotificationService] OS native push notification dispatch error:', err);
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
