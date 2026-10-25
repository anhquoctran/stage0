import { isTauri } from '../../common/services/ipc/ipcClient';
import { getCurrentWindow } from '../../common/services/ipc/ipcWindow';

export function isPrimaryAppWindow(): boolean {
  if (!isTauri()) return true;
  try {
    return getCurrentWindow().label === 'main';
  } catch {
    return false;
  }
}
