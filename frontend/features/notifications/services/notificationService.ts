import { openUrl } from '../../../common/utils/openUrl';
import type { Unsubscribe } from '../../../common/services/ipc/contracts/Unsubscribe';
import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

import { type AppNotification } from '../types/AppNotification';
import { type AppNotificationAction } from '../types/AppNotificationAction';
import { type NotificationDispatchResult } from '../types/NotificationDispatchResult';
import { type NotifyOptions } from '../types/NotifyOptions';
import { useNotificationStore } from '../store/useNotificationStore';
import { usePreferencesStore } from '../../preferences/store/usePreferencesStore';
import i18n from '../../i18n/i18n';

let isListening = false;
let generation = 0;

let unlistenFns: Unsubscribe[] = [];

export const notificationService = {
  /**
   * Initializes the shared notification history and action listeners.
   */
  async init(): Promise<void> {
    if (isListening || !getApplicationServices().platform.capabilities.notifications) return;
    isListening = true;
    const current = ++generation;

    try {
      const stopNotifications = await getApplicationServices().platform.events.subscribe<Record<string, unknown>>('app-notification', (event) => {
        if (current !== generation) return;
        const payload = event;
        const level = (payload.level as AppNotification['level']) || 'info';
        const notification: AppNotification = {
          id: (payload.id as string) || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: (payload.title as string) || i18n.t('notifications.fallbackTitle'),
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

        // Every window receives the same history item, even when OS delivery is denied.
        useNotificationStore.getState().addNotification(notification);
      });
      if (current !== generation) { stopNotifications(); return; }
      unlistenFns = [stopNotifications];
      try {
        const stopActions = await getApplicationServices().platform.events.subscribe<{
          notificationId?: string;
          action: AppNotificationAction;
        }>('notification-action', (event) => {
          if (current === generation) this.handleAction(event.action, event.notificationId);
        });
        if (current !== generation) { stopActions(); return; }
        unlistenFns = [stopNotifications, stopActions];
        await getApplicationServices().notifications.setReady({ ready: true, generation: current });
      } catch (error) {
        if (current === generation) { unlistenFns.forEach(stop => stop()); unlistenFns = []; }
        throw error;
      }
    } catch (err) {
      if (current !== generation) return;
      isListening = false;
      console.warn('[NotificationService] Failed to listen to backend notifications:', err);
    }
  },

  /**
   * Cleans up listeners on app unmount
   */
  destroy(): void {
    generation++;
    if (isListening) void getApplicationServices().notifications.setReady({ ready: false, generation }).catch(error => console.warn('Could not release notification action routing:', error));
    unlistenFns.forEach((unlisten) => unlisten());
    unlistenFns = [];
    isListening = false;
  },

  /**
   * Dispatches through the native OS notification center without prompting.
   * OS authorization is requested explicitly in onboarding or Preferences.
   * - Stores event in notification history for auditing
   * - Guaranteed never to throw an unhandled exception
   */
  async notify(options: NotifyOptions): Promise<NotificationDispatchResult> {
    const settings = useNotificationStore.getState().settings;
    const title = options.titleKey ? i18n.t(options.titleKey, options.values) : options.title || '';
    const body = options.bodyKey ? i18n.t(options.bodyKey, options.values) : options.body || '';

    // Check if channel is disabled
    if (options.channel && settings.channels[options.channel] === false) {
      return {
        notification: {
          id: `notif_skipped_${Date.now()}`,
          title,
          body,
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
      title,
      body,
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
      if (!getApplicationServices().platform.capabilities.notifications) {
        delivery = 'unsupported';
      } else {
        try {
          await getApplicationServices().notifications.dispatchNotification({
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
          const code = (err as { code?: string })?.code;
          delivery = code === 'backend.notifications.permissionDenied' ? 'denied'
            : code === 'backend.notifications.permissionRequired' ? 'permission_required'
            : code === 'backend.notifications.unsupportedPlatform' ? 'unsupported' : 'failed';
          deliveryError = delivery === 'denied' || delivery === 'permission_required'
            ? i18n.t(`notifications.permission.${delivery === 'denied' ? 'denied' : 'prompt'}`) : i18n.t('notifications.deliveryFailed');
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
    if (!getApplicationServices().platform.capabilities.notifications) {
      this.handleAction(action, notificationId);
      return;
    }
    try {
      await getApplicationServices().notifications.dispatchNotificationAction({ notificationId, action });
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
    }

    switch (action.actionType) {
      case 'show_notifications':
        useNotificationStore.getState().setHistoryDrawerOpen(true);
        break;
      case 'open_preferences':
        usePreferencesStore.getState().openPreferences(action.payload || undefined);
        break;
      case 'open_url':
        if (action.payload) {
          void openUrl(action.payload);
        }
        break;
      default:
        console.log('[NotificationService] Unhandled action type:', action.actionType, action.payload);
        break;
    }
  },
};
