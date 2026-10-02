import { create } from 'zustand';
import { AppNotification } from '../types/notification';

interface NotificationState {
  notifications: AppNotification[];
  activeToasts: AppNotification[];
  unreadCount: number;
  isHistoryDrawerOpen: boolean;

  // Actions
  addNotification: (notification: AppNotification) => void;
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  toggleHistoryDrawer: () => void;
  setHistoryDrawerOpen: (open: boolean) => void;
}

const STORAGE_KEY = 'stage0_notification_history';
const MAX_STORED_NOTIFICATIONS = 50;

function loadStoredNotifications(): AppNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_STORED_NOTIFICATIONS)));
  } catch {}
}

const initialHistory = loadStoredNotifications();

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: initialHistory,
  activeToasts: [],
  unreadCount: initialHistory.filter((n) => !n.isRead).length,
  isHistoryDrawerOpen: false,

  addNotification: (notification: AppNotification) => {
    set((state) => {
      const updated = [notification, ...state.notifications].slice(0, MAX_STORED_NOTIFICATIONS);
      persistNotifications(updated);

      // Add to active toasts if autoDismissMs is not strictly disabled or if requested
      const activeToasts = [...state.activeToasts, notification];
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
