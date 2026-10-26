import { create } from 'zustand';
import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import type { SoftwareUpdateState } from '../types/SoftwareUpdateState';
import type { SoftwareUpdateStatus } from '../types/SoftwareUpdateStatus';

export const useSoftwareUpdateStore = create<SoftwareUpdateState>((set, get) => {
  let connections = 0;
  let epoch = 0;
  let unsubscribe: (() => void) | undefined;
  const accept = (status: SoftwareUpdateStatus) => {
    if (!get().status || status.revision >= get().status!.revision) set({ status });
  };
  const perform = async (operation: () => Promise<unknown>) => {
    if (get().pending) return;
    set({ pending: true, error: null });
    try {
      await operation();
    } catch (error) {
      set({ error: String(error) });
    } finally {
      try { accept(await getApplicationServices().softwareUpdates.getStatus()); }
      catch { /* Keep the last event/error when the backend is restarting. */ }
      set({ pending: false });
    }
  };
  return {
    status: null, panelOpen: false, pending: false, error: null,
    openPanel: () => set({ panelOpen: true }),
    closePanel: () => set({ panelOpen: false }),
    connect: () => {
      const services = getApplicationServices();
      connections++;
      if (connections === 1 && services.platform.capabilities.backend) {
        const current = ++epoch;
        void (async () => {
          try {
            const stop = await services.platform.events.subscribe<SoftwareUpdateStatus>('software-update-state', (status) => {
              if (current === epoch) accept(status);
            });
            if (current !== epoch) { stop(); return; }
            unsubscribe = stop;
            const status = await services.softwareUpdates.getStatus();
            if (current === epoch) accept(status);
          } catch (error) {
            if (current === epoch) set({ error: `Could not load software update status: ${String(error)}` });
          }
        })();
      }
      let disposed = false;
      return () => {
        if (disposed) return;
        disposed = true;
        if (--connections === 0) {
          epoch++;
          unsubscribe?.();
          unsubscribe = undefined;
        }
      };
    },
    check: () => perform(async () => accept(await getApplicationServices().softwareUpdates.check())),
    download: () => perform(() => getApplicationServices().softwareUpdates.download()),
    install: (savedWorkConfirmed) => perform(() => getApplicationServices().softwareUpdates.install({ savedWorkConfirmed })),
  };
});
