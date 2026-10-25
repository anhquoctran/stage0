import { useState, useEffect } from 'react';
import { invoke } from '../../../common/services/ipc/ipcClient';
import { DEFAULT_RELEASE_NOTES } from '../config/releaseNotes';

export function useReleaseNotes(customContent?: string): string {
  const [content, setContent] = useState<string>(customContent || DEFAULT_RELEASE_NOTES);

  useEffect(() => {
    if (customContent !== undefined) {
      setContent(customContent);
      return;
    }

    let isMounted = true;
    invoke<string>('get_release_notes')
      .then((notes) => {
        if (isMounted && notes && notes.trim().length > 0) {
          setContent(notes);
        }
      })
      .catch(() => {
        // Fallback to static build-time notes if invoke fails or running outside Tauri
      });

    return () => {
      isMounted = false;
    };
  }, [customContent]);

  return content;
}

