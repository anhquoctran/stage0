import React, { useCallback, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { ToastContainer } from './ToastContainer';
import { useNotificationStore } from '../../store/useNotificationStore';
import { applyThemeToDocument, resolveTheme, useThemeStore } from '../../store/useThemeStore';
import type { AppNotification, AppNotificationAction } from '../../types/notification';

const HOST_WIDTH = 420;
const MIN_HOST_HEIGHT = 84;

function isMacOS() {
  return /mac/i.test(navigator.userAgent || navigator.platform);
}

function notificationFromPayload(payload: Record<string, unknown>): AppNotification {
  const level = (payload.level as AppNotification['level']) || 'info';
  const variant = (payload.variant as AppNotification['variant']) ||
    (level === 'success' || level === 'warning' ? level : level === 'error' ? 'danger' : 'default');

  return {
    id: (payload.id as string) || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: (payload.title as string) || 'Stage0 Notification',
    body: (payload.body as string) || '',
    level,
    variant,
    timestamp: Date.now(),
    isRead: false,
    channel: payload.channel as AppNotification['channel'],
    actions: Array.isArray(payload.actions) ? (payload.actions as AppNotificationAction[]) : undefined,
    clickAction: (payload.clickAction || payload.click_action) as AppNotificationAction | undefined,
    dismissPolicy: (payload.dismissPolicy || payload.dismiss_policy) as AppNotification['dismissPolicy'] || 'both',
    autoDismissMs:
      typeof payload.autoDismissMs === 'number'
        ? payload.autoDismissMs
        : typeof payload.auto_dismiss_ms === 'number'
          ? payload.auto_dismiss_ms
          : 6000,
  };
}

export const NotificationHost: React.FC = () => {
  const activeToasts = useNotificationStore((state) => state.activeToasts);
  const position = useMemo(() => (isMacOS() ? 'top-right' : 'bottom-right'), []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.style.backgroundColor = 'transparent';
    body.classList.add('notification-host-window');
    body.style.backgroundColor = 'transparent';
    body.style.margin = '0';
    body.style.overflow = 'hidden';

    const { themeMode } = useThemeStore.getState();
    applyThemeToDocument(resolveTheme(themeMode));

    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'stage0_catppuccin_theme_mode') return;
      const mode = event.newValue;
      if (mode === 'dark' || mode === 'light' || mode === 'system') {
        useThemeStore.getState().setThemeMode(mode);
        // applyThemeToDocument sets the page background; keep the floating host clear.
        body.style.backgroundColor = 'transparent';
      }
    };
    window.addEventListener('storage', onStorage);

    let unlisten: (() => void) | undefined;
    let disposed = false;
    void listen<Record<string, unknown>>('stage0-toast', (event) => {
      useNotificationStore.getState().showToast(notificationFromPayload(event.payload));
    }).then(async (stopListening) => {
      if (disposed) {
        stopListening();
        return;
      }
      unlisten = stopListening;
      await invoke('notification_host_ready');
    }).catch((error) => console.warn('[NotificationHost] Could not initialize toast listener:', error));

    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener('storage', onStorage);
      body.classList.remove('notification-host-window');
    };
  }, []);

  const resizeAndShow = useCallback(async (contentHeight: number) => {
    try {
      const host = getCurrentWindow();
      const monitor = await currentMonitor();
      const scale = monitor?.scaleFactor || 1;
      const workArea = monitor?.workArea;
      const maxHeight = workArea ? Math.floor(workArea.size.height / scale) - 48 : 640;
      const height = Math.max(MIN_HOST_HEIGHT, Math.min(contentHeight, maxHeight));

      await host.setSize(new LogicalSize(HOST_WIDTH, height));
      if (monitor && workArea) {
        const margin = Math.round(16 * scale);
        const x = workArea.position.x + workArea.size.width - Math.round(HOST_WIDTH * scale) - margin;
        const y = isMacOS()
          ? workArea.position.y + margin
          : workArea.position.y + workArea.size.height - Math.round(height * scale) - margin;
        await host.setPosition(new PhysicalPosition(x, y));
      }
      await host.show();
    } catch (error) {
      console.warn('[NotificationHost] Could not show toast window:', error);
    }
  }, []);

  useEffect(() => {
    if (activeToasts.length > 0) return;
    void invoke('set_notification_host_visibility', { visible: false }).catch(() => undefined);
  }, [activeToasts.length]);

  return <ToastContainer position={position} onHeightChange={resizeAndShow} />;
};

