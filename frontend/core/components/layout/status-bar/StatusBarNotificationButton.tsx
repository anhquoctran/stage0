import React from 'react';
import { Bell } from '../../../../common/components/icons/Bell';
import { useGitTaskStore } from '../../../../features/git/store/useGitTaskStore';
import { useNotificationStore } from '../../../../features/notifications/store/useNotificationStore';

export const StatusBarNotificationButton: React.FC = () => {
  const { unreadCount, isHistoryDrawerOpen, toggleHistoryDrawer } = useNotificationStore();

  return (
    <button
      type="button"
      onClick={() => {
        useGitTaskStore.getState().setBackgroundManagerOpen(false);
        toggleHistoryDrawer();
      }}
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      aria-expanded={isHistoryDrawerOpen}
      className={`relative grid h-6 w-7 place-items-center transition-colors cursor-pointer ${
        isHistoryDrawerOpen
          ? 'bg-surface1 text-text'
          : 'text-subtext0 hover:bg-surface0 hover:text-text'
      }`}
      title={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
    >
      <Bell className="w-3.5 h-3.5" />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-0.5 h-1.5 w-1.5 bg-brand ring-1 ring-mantle"
        />
      )}
    </button>
  );
};

