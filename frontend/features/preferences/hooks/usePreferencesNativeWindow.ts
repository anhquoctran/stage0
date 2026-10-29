import { useEffect, useRef, useState } from 'react';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { PREFERENCES_WINDOW_LABEL } from '../services/preferencesWindowService';
import { useTranslation } from 'react-i18next';

/** Native OS close requests use exactly the same transaction path as Cancel. */
export function usePreferencesNativeWindow(standalone: boolean, isOpen: boolean, onCancel: () => void) {
  const services = useApplicationServices();
  const { t } = useTranslation();
  const native = standalone && services.platform.capabilities.backend && services.platform.capabilities.windows;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const wasOpen = useRef(false);
  const closing = useRef(false);
  const [error, setError] = useState<{ operation: 'initialize' | 'close'; detail: string } | null>(null);

  useEffect(() => {
    if (!native || !isOpen) return;
    let disposed = false;
    const subscriptions = new Set<() => void>();
    const register = (pending: Promise<() => void>) => pending.then(stop => {
      if (disposed) stop();
      else subscriptions.add(stop);
    });
    void Promise.all([
      register(services.platform.events.subscribe('preferences-window-close-requested', () => {
        if (!disposed) cancelRef.current();
      }, { target: { kind: 'label', label: PREFERENCES_WINDOW_LABEL } })),
      register(services.platform.events.subscribe<{ tab: string | null }>('preferences-window-open', payload => {
        if (!disposed && payload?.tab) usePreferencesStore.getState().setInitialPreferencesTab(payload.tab);
      }, { target: { kind: 'label', label: PREFERENCES_WINDOW_LABEL } })),
    ]).then(async () => {
      if (!disposed) await services.application.preferencesWindowReady();
    }).catch(cause => {
      if (!disposed) setError({ operation: 'initialize', detail: String(cause) });
    });
    return () => {
      disposed = true;
      subscriptions.forEach(stop => stop());
      subscriptions.clear();
    };
  }, [native, isOpen, services]);

  useEffect(() => {
    if (!native) return;
    if (isOpen) { wasOpen.current = true; return; }
    if (!wasOpen.current || closing.current) return;
    closing.current = true;
    void services.application.closePreferencesWindow().catch(cause => {
      closing.current = false;
      setError({ operation: 'close', detail: String(cause) });
      usePreferencesStore.setState({ isPreferencesOpen: true });
    });
  }, [native, isOpen, services]);
  return error ? t(`preferences.window.${error.operation}Error`, { error: error.detail }) : null;
}
