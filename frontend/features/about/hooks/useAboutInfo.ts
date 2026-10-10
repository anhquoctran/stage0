import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SOFTWARE_ABOUT } from '../config/about';
import { type SoftwareAboutInfo } from '../types/SoftwareAboutInfo';

export function useAboutInfo(): SoftwareAboutInfo {
  const [aboutInfo, setAboutInfo] = useState<SoftwareAboutInfo>(SOFTWARE_ABOUT);

  useEffect(() => {
    let isMounted = true;
    invoke<SoftwareAboutInfo>('get_app_info')
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
