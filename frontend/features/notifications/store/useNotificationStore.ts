import { create } from 'zustand';
import { type AppNotification } from '../types/AppNotification';
import { type NotificationSettings } from '../types/NotificationSettings';
import type { NotificationState } from '../types/NotificationState';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  channels: {
    softwareUpdates: true,
    aiReview: true,
    gitSync: true,
    guardrails: true,
  },
};

const HISTORY_STORAGE_KEY = 'stage0_notification_history';

const SETTINGS_STORAGE_KEY = 'stage0_notification_settings';

const MAX_STORED_NOTIFICATIONS = 50;

function loadStoredSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        channels: {
          ...DEFAULT_NOTIFICATION_SETTINGS.channels,
          ...(parsed.channels || {}),
        },
      };
    }
  } catch {}
  return DEFAULT_NOTIFICATION_SETTINGS;
}

function persistSettings(settings: NotificationSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
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

// Tauri webviews have separate Zustand instances even though their localStorage
// is shared. Keep history, category switches, unread count, and the taskbar dot
// aligned when notifications are read or cleared in another window.
if (typeof window !== 'undefined') {
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

    if (event.key === SETTINGS_STORAGE_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        useNotificationStore.setState({
          settings: {
            channels: {
              ...DEFAULT_NOTIFICATION_SETTINGS.channels,
              ...(parsed.channels || {}),
            },
          },
        });
      } catch {
        // Ignore malformed settings and keep the current in-memory value.
      }
    }
  });
}
