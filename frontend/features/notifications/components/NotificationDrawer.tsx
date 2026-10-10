import React, { useEffect } from 'react';
import { Bell } from '../../../common/components/icons/Bell';
import { Check } from '../../../common/components/icons/Check';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { X } from '../../../common/components/icons/X';
import { formatDateTime } from '@/common/utils/dateTime';
import { useNotificationStore } from '../store/useNotificationStore';
import { NotificationMarker } from './NotificationMarker';

export const NotificationDrawer: React.FC = () => {
  const {
    notifications,
    unreadCount,
    isHistoryDrawerOpen,
    setHistoryDrawerOpen,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotificationStore();

  useEffect(() => {
    if (!isHistoryDrawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHistoryDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHistoryDrawerOpen, setHistoryDrawerOpen]);

  if (!isHistoryDrawerOpen) return null;

  return (
    <div className="absolute inset-x-0 top-8.5 bottom-7 z-[45]">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close notifications"
        onClick={() => setHistoryDrawerOpen(false)}
        className="absolute inset-0 h-full w-full cursor-default bg-crust/25"
      />

      <aside
        id="notification-drawer"
        aria-label="Notifications"
        className="absolute inset-y-0 right-0 z-10 flex w-full max-w-[26rem] flex-col bg-base shadow-2xl animate-in slide-in-from-right-3 fade-in duration-150"
      >
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-surface0 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Bell className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-text">Notifications</h2>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-red">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="rounded px-2 py-1 text-[11px] text-subtext0 transition-colors hover:bg-surface0 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={notifications.length === 0}
              aria-label="Clear all notifications"
              title="Clear all notifications"
              className="grid h-7 w-7 place-items-center rounded text-subtext0 transition-colors hover:bg-red/10 hover:text-red disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setHistoryDrawerOpen(false)}
              aria-label="Close notifications"
              className="grid h-7 w-7 place-items-center rounded text-subtext0 transition-colors hover:bg-surface0 hover:text-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {notifications.length > 0 ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ul aria-live="polite" className="divide-y divide-surface0">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={`flex gap-3 px-4 py-3 transition-colors ${
                      notification.isRead ? 'bg-transparent' : 'bg-surface0/35'
                    }`}
                  >
                    <NotificationMarker notification={notification} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`break-words text-xs ${notification.isRead ? 'font-medium text-subtext1' : 'font-semibold text-text'}`}>
                          {notification.title}
                        </h3>
                        {!notification.isRead && (
                          <span aria-label="Unread" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-subtext0">
                        {notification.body}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <time
                          dateTime={new Date(notification.timestamp).toISOString()}
                          className="text-[10px] text-subtext0/75"
                        >
                          {formatDateTime(notification.timestamp)}
                        </time>
                        {!notification.isRead && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notification.id)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-subtext0 transition-colors hover:bg-surface1 hover:text-text"
                          >
                            <Check className="h-3 w-3" />
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <Bell className="h-6 w-6 text-subtext0/60" />
            <p className="text-xs font-medium text-subtext1">You're all caught up</p>
            <p className="text-[11px] text-subtext0">New notifications will appear here.</p>
          </div>
        )}
      </aside>
    </div>
  );
};
