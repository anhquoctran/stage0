import { useEffect } from 'react';
import { useApplicationServices } from '../services/runtime/useApplicationServices';
import { useWindowChromeStore } from '../store/useWindowChromeStore';
import { startupProgress } from '../services/startup/startupProgress';

/** One refresh owner per window; re-read desktop settings after returning from Tweaks. */
export function useDesktopWindowChrome() {
  const services = useApplicationServices();
  const ready = useWindowChromeStore((state) => state.ready);
  useEffect(() => {
    if (!services.platform.capabilities.backend) {
      useWindowChromeStore.setState({ ready: true });
      return;
    }
    let disposed = false;
    let version = 0;
    const refresh = async () => {
      const request = ++version;
      try {
        const profile = await services.application.getWindowChrome();
        if (!disposed && request === version) useWindowChromeStore.setState({ profile, ready: true });
      } catch (error) {
        if (!disposed && request === version) {
          console.error('Could not read native window configuration:', error);
          if (!useWindowChromeStore.getState().ready) startupProgress.fail();
        }
      }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('stage0-preferences-updated', refresh);
    return () => {
      disposed = true;
      version += 1;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('stage0-preferences-updated', refresh);
    };
  }, [services]);
  return ready;
}
