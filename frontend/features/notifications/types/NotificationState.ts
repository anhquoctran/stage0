import { type AppNotification } from './AppNotification';
import { type NotificationSettings } from './NotificationSettings';

export interface NotificationState {
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
  showToast: (notification: AppNotification) => void;
  dismissToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  toggleHistoryDrawer: () => void;
  setHistoryDrawerOpen: (open: boolean) => void;
}
