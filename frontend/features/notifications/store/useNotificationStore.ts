import { create } from 'zustand';
import { type AppNotification } from '../types/AppNotification';
import { type NotificationSettings } from '../types/NotificationSettings';
import type { NotificationState } from '../types/NotificationState';
import { preferencesJsonService } from '../../preferences/services/preferencesJsonService';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  channels: {
    aiReview: true,
    gitSync: true,
    guardrails: true,
  },
};

const HISTORY_STORAGE_KEY = 'stage0_notification_history';

const SETTINGS_STORAGE_KEY = 'stage0_notification_settings';

const MAX_STORED_NOTIFICATIONS = 50;

function normalizeSettings(value: Partial<NotificationSettings> | null | undefined): NotificationSettings {
  return {
    channels: {
      aiReview: typeof value?.channels?.aiReview === 'boolean' ? value.channels.aiReview : DEFAULT_NOTIFICATION_SETTINGS.channels.aiReview,
      gitSync: typeof value?.channels?.gitSync === 'boolean' ? value.channels.gitSync : DEFAULT_NOTIFICATION_SETTINGS.channels.gitSync,
      guardrails: typeof value?.channels?.guardrails === 'boolean' ? value.channels.guardrails : DEFAULT_NOTIFICATION_SETTINGS.channels.guardrails,
    },
  };
}

function loadStoredSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS;
  const configured = window.__STAGE0_PREFERENCES__?.notifications as Partial<NotificationSettings> | undefined;
  if (configured) return normalizeSettings(configured);
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      return normalizeSettings(JSON.parse(raw));
    }
  } catch {}
  return DEFAULT_NOTIFICATION_SETTINGS;
}

function persistSettings(settings: NotificationSettings) {
  void preferencesJsonService.patch({ notifications: settings }).catch((error) => console.error('Could not save preferences.json:', error));
}

function loadStoredNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_STORED_NOTIFICATIONS);
      }
    }
  } catch {}
  return [];
}

function persistNotifications(notifications: AppNotification[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_STORED_NOTIFICATIONS)));
  } catch {}
}

const initialSettings = loadStoredSettings();

const initialHistory = loadStoredNotifications();

export const useNotificationStore = create<NotificationState>((set) => ({
  settings: initialSettings,
  notifications: initialHistory,
  activeToasts: [],
  unreadCount: initialHistory.filter((n) => !n.isRead).length,
  isHistoryDrawerOpen: false,

  updateSettings: (partial) => {
    set((state) => {
      const updated: NotificationSettings = {
        ...state.settings,
        ...partial,
        channels: {
          ...state.settings.channels,
          ...(partial.channels || {}),
        },
      };
      persistSettings(updated);
      return { settings: updated };
    });
  },

  updateChannel: (channel, enabled) => {
    set((state) => {
      const updated: NotificationSettings = {
        ...state.settings,
        channels: {
          ...state.settings.channels,
          [channel]: enabled,
        },
      };
      persistSettings(updated);
      return { settings: updated };
    });
  },

  resetSettings: () => {
    persistSettings(DEFAULT_NOTIFICATION_SETTINGS);
    set({ settings: DEFAULT_NOTIFICATION_SETTINGS });
  },

  addNotification: (notification: AppNotification) => {
    set((state) => {
      // The sender records locally and also emits the same notification to every
      // window. De-duplicate by stable ID so a window never stores it twice.
      if (state.notifications.some((existing) => existing.id === notification.id)) {
        return state;
      }

      const updated = [notification, ...state.notifications].slice(0, MAX_STORED_NOTIFICATIONS);
      persistNotifications(updated);

      const unreadCount = state.unreadCount + (notification.isRead ? 0 : 1);

      return {
        notifications: updated,
        unreadCount,
      };
    });
  },

  showToast: (notification: AppNotification) => {
    set((state) => {
      if (state.activeToasts.some((toast) => toast.id === notification.id)) return state;
      return { activeToasts: [...state.activeToasts, notification] };
    });
  },

  dismissToast: (id: string) => {
    set((state) => ({
      activeToasts: state.activeToasts.filter((t) => t.id !== id),
    }));
  },

  markAsRead: (id: string) => {
    set((state) => {
      const updated = state.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      persistNotifications(updated);
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.isRead).length,
      };
    });
  },

  markAllAsRead: () => {
    set((state) => {
      const updated = state.notifications.map((n) => ({ ...n, isRead: true }));
      persistNotifications(updated);
      return {
        notifications: updated,
        unreadCount: 0,
      };
    });
  },

  clearAll: () => {
    persistNotifications([]);
    set({
      notifications: [],
      activeToasts: [],
      unreadCount: 0,
    });
  },

  toggleHistoryDrawer: () => {
    set((state) => ({ isHistoryDrawerOpen: !state.isHistoryDrawerOpen }));
  },

  setHistoryDrawerOpen: (open: boolean) => {
    set({ isHistoryDrawerOpen: open });
  },
}));

// Preferences changes are broadcast from the shared JSON document; notification
// history remains UI state in localStorage and is synchronized separately.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('stage0-preferences-updated', (event) => {
    const settings = (event as CustomEvent<Window['__STAGE0_PREFERENCES__']>).detail;
    if (settings?.notifications) useNotificationStore.setState({ settings: normalizeSettings(settings.notifications) });
  });

  window.addEventListener('storage', (event) => {
    if (event.key === HISTORY_STORAGE_KEY) {
      try {
        const notifications = event.newValue ? JSON.parse(event.newValue) : [];
        if (!Array.isArray(notifications)) return;
        const bounded = notifications.slice(0, MAX_STORED_NOTIFICATIONS) as AppNotification[];
        useNotificationStore.setState({
          notifications: bounded,
          unreadCount: bounded.filter((notification) => !notification.isRead).length,
        });
      } catch {
        // Ignore malformed storage written by an older or interrupted app session.
      }
      return;
    }

  });
}
