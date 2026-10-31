import { useEffect, useRef, useState } from 'react';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import type { NotificationPermissionState } from '../types/NotificationPermissionState';

/** OS authorization is read-only app state, separate from preference drafts. */
export function useNotificationPermission() {
  const services = useApplicationServices();
  const supported = services.platform.capabilities.notifications;
  const [permission, setPermission] = useState<NotificationPermissionState | null>(supported ? null : 'unsupported');
  const version = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!supported) return;
    let disposed = false;
    const refresh = () => {
      const request = ++version.current;
      void services.notifications.getPermission().then(value => {
        if (!disposed && request === version.current) { setPermission(value); setError(false); }
      }).catch(() => { if (!disposed && request === version.current) setError(true); });
    };
    refresh();
    window.addEventListener('focus', refresh);
    let unlisten: (() => void) | undefined;
    void services.platform.events.subscribe('notification-permission-changed', refresh).then(stop => {
      if (disposed) stop(); else unlisten = stop;
    }).catch(() => { /* Focus still refreshes authorization if event setup fails. */ });
    return () => { disposed = true; version.current++; unlisten?.(); window.removeEventListener('focus', refresh); };
  }, [services, supported]);

  const request = async () => {
    if (busy || !supported) return;
    const request = ++version.current;
    setBusy(true); setError(false);
    try {
      const state = await services.notifications.requestPermission();
      if (request === version.current) setPermission(state);
    }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  const openSettings = async () => {
    setError(false);
    try { await services.notifications.openSettings(); }
    catch { setError(true); }
  };
  return { permission, busy, error, request, openSettings };
}
