import { create } from 'zustand';
import { AppNotification, NotificationSettings } from '../types/notification';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enableDesktopNotifications: true,
  enableInAppToasts: true,
  playAlertSound: true,
  toastDurationMs: 5000,
  channels: {
    softwareUpdates: true,
    aiReview: true,
    gitSync: true,
    guardrails: true,
  },
};

interface NotificationState {
  settings: NotificationSettings;
  notifications: AppNotification[];
  activeToasts: AppNotification[];
  unreadCount: number;
  isHistoryDrawerOpen: boolean;

  // Actions
  updateSettings: (partial: Partial<NotificationSettings>) => void;
  updateChannel: (channel: keyof NotificationSettings['channels'], enabled: boolean) => void;
  resetSettings: () => void;
  addNotification: (notification: AppNotification) => void;
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  toggleHistoryDrawer: () => void;
  setHistoryDrawerOpen: (open: boolean) => void;
}

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
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...parsed,
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
      const updated = [notification, ...state.notifications].slice(0, MAX_STORED_NOTIFICATIONS);
      persistNotifications(updated);

      // Only enqueue toast if in-app toasts are enabled
      let activeToasts = state.activeToasts;
      if (state.settings.enableInAppToasts) {
        activeToasts = [...state.activeToasts, notification];
      }

      const unreadCount = state.unreadCount + (notification.isRead ? 0 : 1);

      return {
        notifications: updated,
        activeToasts,
        unreadCount,
      };
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
