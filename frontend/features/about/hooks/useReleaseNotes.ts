import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { useState, useEffect } from 'react';

import { DEFAULT_RELEASE_NOTES } from '../config/releaseNotes';

export function useReleaseNotes(customContent?: string): string {
  const appServices = useApplicationServices();
  const [content, setContent] = useState<string>(customContent || DEFAULT_RELEASE_NOTES);

  useEffect(() => {
    if (customContent !== undefined) {
      setContent(customContent);
      return;
    }

    let isMounted = true;
    appServices.about.getReleaseNotes()
      .then((notes) => {
        if (isMounted && notes && notes.trim().length > 0) {
          setContent(notes);
        }
      })
      .catch(() => {
        // Retain static build-time notes when the service is unavailable or fails.
      });

    return () => {
      isMounted = false;
    };
  }, [customContent]);

  return content;
}

