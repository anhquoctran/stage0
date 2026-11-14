import { readDisplayScale } from '../../../common/utils/displayScale';
import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';

const PRIMARY_ACCENT = '#9333ea';
let windowsDotIcon: { size: number; promise: Promise<Uint8Array> } | undefined;
let publication = 0;

async function createWindowsDotIcon(): Promise<Uint8Array> {
  const size = Math.ceil(16 * readDisplayScale());
  if (windowsDotIcon?.size !== size) {
    const promise = new Promise<Uint8Array>((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not create the taskbar badge image'));
        return;
      }

      context.setTransform(size / 16, 0, 0, size / 16, 0, 0);
      context.beginPath();
      context.arc(8, 8, 6.5, 0, Math.PI * 2);
      context.fillStyle = PRIMARY_ACCENT;
      context.fill();
      context.lineWidth = 1;
      context.strokeStyle = '#ffffff';
      context.stroke();

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Could not encode the taskbar badge image'));
          return;
        }
        void blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)), reject);
      }, 'image/png');
    });
    windowsDotIcon = { size, promise };
    void promise.catch(() => {
      if (windowsDotIcon?.promise === promise) windowsDotIcon = undefined;
    });
  }
  return windowsDotIcon.promise;
}

export async function syncUnreadBadge(unreadCount: number): Promise<void> {
  if (!getApplicationServices().platform.capabilities.windows) return;

  const revision = ++publication;
  const userAgent = navigator.userAgent || navigator.platform;
  const window = getApplicationServices().platform.windows.current();
  try {
    if (/windows/i.test(userAgent)) {
      const icon = unreadCount > 0 ? await createWindowsDotIcon() : undefined;
      if (revision === publication) await window.setOverlayIcon(icon);
    } else if (/mac/i.test(userAgent)) {
      await window.setBadgeLabel(unreadCount > 0 ? '•' : undefined);
    }
    // Linux desktop environments do not share a launcher-badge API.
  } catch (error) {
    console.warn('[NotificationBadge] Could not update the unread badge:', error);
  }
}
