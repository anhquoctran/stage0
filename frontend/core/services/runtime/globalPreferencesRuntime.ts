import type { Unsubscribe } from '../../../common/services/ipc/contracts/Unsubscribe';
import { preferencesJsonService } from '../../../features/preferences/services/preferencesJsonService';
import { getApplicationServices } from './applicationRuntime';
import { synchronizeWorkspacePreferences } from '../../../features/git/services/synchronizeWorkspacePreferences';

let startPromise: Promise<void> | undefined;

/** One app-wide persisted-preferences subscription per WebView, across all repos. */
export function startGlobalPreferencesRuntime(): Promise<void> {
  if (startPromise) return startPromise;
  startPromise = start();
  return startPromise;
}

async function start(): Promise<void> {
  const services = getApplicationServices();
  if (!services.platform.capabilities.preferencesFile || !services.platform.capabilities.events) return;
  let disposed = false;
  let dirty = false;
  let loading: Promise<void> | undefined;
  let unlisten: Unsubscribe | undefined;
  const reload = () => {
    dirty = true;
    if (loading) return loading;
    loading = (async () => {
      while (dirty && !disposed) {
        dirty = false;
        try {
          // accept() publishes to each feature's existing local runtime handler.
          const document = await preferencesJsonService.load();
          if (!disposed && document.settings && !document.validationError) {
            synchronizeWorkspacePreferences(document.settings);
          }
        } catch (error) {
          console.error('Could not synchronize app preferences:', error);
        }
      }
    })().finally(() => { loading = undefined; });
    return loading;
  };
  unlisten = await services.platform.events.subscribe<string>('preferences-changed', revision => {
    if (!disposed && revision !== window.__STAGE0_PREFERENCES_REVISION__) void reload();
  }, { target: { kind: 'application' } });
  window.addEventListener('beforeunload', () => {
    disposed = true;
    unlisten?.();
  }, { once: true });
  // Read after subscribing: changes during bootstrap cannot be missed.
  await reload();
}
