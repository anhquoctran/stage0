import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { useEffect, useRef, useState } from 'react';

import { availableUiFontFamilies, browserFontDiscoveryAvailable, loadSystemFontFamilies } from '../services/systemFontCatalog';

export function useSystemFontFamilies() {
  const appServices = useApplicationServices();
  const [families, setFamilies] = useState(availableUiFontFamilies);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const epoch = useRef(0);
  const native = appServices.platform.capabilities.systemFonts;
  const canDiscover = native || browserFontDiscoveryAvailable();
  const refresh = async (requestBrowserAccess = false) => {
    const request = ++epoch.current;
    setIsLoading(true);
    setError(null);
    try {
      const names = await loadSystemFontFamilies(requestBrowserAccess);
      if (epoch.current === request) setFamilies(names);
    } catch (failure) {
      if (epoch.current === request) setError(`Could not load system fonts: ${String(failure instanceof Error ? failure.message : failure)}`);
    } finally {
      if (epoch.current === request) setIsLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
    return () => { epoch.current++; };
  }, []);
  return { families, isLoading, error, refresh, native, canDiscover };
}
