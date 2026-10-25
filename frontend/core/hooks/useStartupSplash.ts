import { useEffect } from 'react';
import { startupProgress } from '../services/startup/startupProgress';
import { useApplicationServices } from '../services/runtime/useApplicationServices';

/** Wait for the ready workspace to commit and paint before publishing 100%. */
export function useStartupSplash(ready: boolean) {
  const services = useApplicationServices();
  useEffect(() => {
    if (!ready) return;
    if (!window.__STAGE0_STARTUP__) {
      // A failed bootstrap asset must not cover an otherwise ready application.
      const reveal = async () => {
        if (services.platform.capabilities.windows) await services.application.windowPrepareMain();
        document.getElementById('startup-splash')?.remove();
        if (services.platform.capabilities.windows) await services.application.windowShow();
      };
      void reveal().catch((error) => console.error('Could not reveal the main window:', error));
      return;
    }
    let disposed = false;
    let cancelDismissal: (() => void) | undefined;
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        if (disposed) return;
        startupProgress.complete('workspace');
        startupProgress.begin('ready');
        cancelDismissal = startupProgress.finish(services.platform.capabilities.windows ? {
          prepare: () => services.application.windowPrepareMain(),
          reveal: () => services.application.windowShow(),
        } : undefined);
      });
    });
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      cancelDismissal?.();
    };
  }, [ready, services]);
}
