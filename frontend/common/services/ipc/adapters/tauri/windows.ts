import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
import { LogicalSize, PhysicalPosition } from '@tauri-apps/api/dpi';
import type { WindowService } from '../../contracts/WindowService';

export function createTauriWindows(): WindowService {
  return {
    current: () => {
      const handle = getCurrentWindow();
      return {
        label: handle.label,
        setLogicalSize: size => handle.setSize(new LogicalSize(size.width, size.height)),
        setPhysicalPosition: position => handle.setPosition(new PhysicalPosition(position.x, position.y)),
        show: () => handle.show(),
        setOverlayIcon: bytes => handle.setOverlayIcon(bytes),
        setBadgeLabel: label => handle.setBadgeLabel(label),
      };
    },
    currentMonitor: async () => {
      const monitor = await currentMonitor();
      if (monitor === null) return null;
      return {
        name: monitor.name,
        scaleFactor: monitor.scaleFactor,
        position: { x: monitor.position.x, y: monitor.position.y },
        size: { width: monitor.size.width, height: monitor.size.height },
        workArea: {
          position: { x: monitor.workArea.position.x, y: monitor.workArea.position.y },
          size: { width: monitor.workArea.size.width, height: monitor.workArea.size.height },
        },
      };
    },
  };
}
