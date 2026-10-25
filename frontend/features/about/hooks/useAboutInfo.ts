import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { useState, useEffect } from 'react';

import { SOFTWARE_ABOUT } from '../config/about';
import { type SoftwareAboutInfo } from '../types/SoftwareAboutInfo';

export function useAboutInfo(): SoftwareAboutInfo {
  const appServices = useApplicationServices();
  const [aboutInfo, setAboutInfo] = useState<SoftwareAboutInfo>(SOFTWARE_ABOUT);

  useEffect(() => {
    let isMounted = true;
    appServices.about.getAppInfo()
      .then((info) => {
        if (isMounted && info) {
          setAboutInfo(info);
        }
      })
      .catch(() => {
        // Fallback to static build-time metadata (e.g. in web browser mock mode)
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return aboutInfo;
}
