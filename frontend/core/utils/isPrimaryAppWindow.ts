import { getApplicationServices } from '../services/runtime/applicationRuntime';

export function isPrimaryAppWindow(): boolean {
  if (!getApplicationServices().platform.capabilities.windows) return true;
  try {
    return getApplicationServices().platform.windows.current().label === 'main';
  } catch {
    return false;
  }
}
