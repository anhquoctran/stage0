import type { MouseEvent } from 'react';
import type { ApplicationService } from '../../../services/transport/ApplicationService';
import type { WindowChrome } from '../../../types/WindowChrome';

/** Custom Linux/macOS frames use Tauri dragging and explicit double-click zoom. */
export function titleBarMouseDown(
  profile: WindowChrome,
  application: ApplicationService,
  customMacFrame = false,
) {
  const customFrame = profile.platform === 'linux' || customMacFrame;
  if (!customFrame || profile.nativeFrame) return undefined;
  return (event: MouseEvent) => {
    if (event.button !== 0 || (event.detail !== 1 && event.detail !== 2)) return;
    const target = event.target as Element;
    if (target.closest('button, input, select, textarea, a, nav, [role="button"], [role="menu"], [role="menuitem"], [contenteditable]')) return;
    event.preventDefault();
    const action = event.detail === 1 ? application.windowStartDragging()
      : profile.doubleClickAction === 'maximize' ? application.windowToggleMaximize()
        : profile.doubleClickAction === 'minimize' ? application.windowMinimize() : undefined;
    void action?.catch((error) => console.warn('Could not perform title bar action:', error));
  };
}
