import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

const PRIMARY_ACCENT = '#b87ff4';
let windowsDotIcon: Promise<Uint8Array> | undefined;

async function createWindowsDotIcon(): Promise<Uint8Array> {
  if (!windowsDotIcon) {
    windowsDotIcon = new Promise<Uint8Array>((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not create the taskbar badge image'));
        return;
      }

      context.beginPath();
      context.arc(8, 8, 6.5, 0, Math.PI * 2);
      context.fillStyle = PRIMARY_ACCENT;
      context.fill();
      context.lineWidth = 1;
      context.strokeStyle = '#ffffff';
      context.stroke();

      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error('Could not encode the taskbar badge image'));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, 'image/png');
    });
  }
  return windowsDotIcon;
}

export async function syncUnreadBadge(unreadCount: number): Promise<void> {
  if (!isTauri()) return;

  const userAgent = navigator.userAgent || navigator.platform;
  const window = getCurrentWindow();
  try {
    if (/windows/i.test(userAgent)) {
      await window.setOverlayIcon(unreadCount > 0 ? await createWindowsDotIcon() : undefined);
    } else if (/mac/i.test(userAgent)) {
      await window.setBadgeLabel(unreadCount > 0 ? '•' : undefined);
    }
    // Linux desktop environments do not share a launcher-badge API.
  } catch (error) {
    console.warn('[NotificationBadge] Could not update the unread badge:', error);
  }
}

