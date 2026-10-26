import { useEffect, useState } from 'react';
import { preferencesJsonService } from '../../preferences/services/preferencesJsonService';

export function useAutomaticUpdatePreference() {
  const read = () => typeof window !== 'undefined' && window.__STAGE0_PREFERENCES__?.general?.autoCheckUpdates !== false;
  const [enabled, setEnabled] = useState(read);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const refresh = () => setEnabled(read());
    window.addEventListener('stage0-preferences-updated', refresh);
    return () => window.removeEventListener('stage0-preferences-updated', refresh);
  }, []);
  const change = async (value: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await preferencesJsonService.patch({ general: { autoCheckUpdates: value } });
      setEnabled(value);
    } catch (error) {
      setError(String(error));
    } finally {
      setSaving(false);
    }
  };
  return { enabled, saving, error, change };
}
