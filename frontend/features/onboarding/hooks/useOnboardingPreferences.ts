import { useEffect, useRef, useState } from 'react';
import {
  captureOnboardingPreferences,
  previewOnboardingPreferences,
  saveOnboardingPreferences,
} from '../services/onboardingPreferences';

export function useOnboardingPreferences() {
  const [baseline, setBaseline] = useState(captureOnboardingPreferences);
  const [settings, setSettings] = useState(() => structuredClone(baseline));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saving = useRef(false);
  useEffect(() => previewOnboardingPreferences(settings), [settings]);
  useEffect(() => () => previewOnboardingPreferences(captureOnboardingPreferences()), []);

  const save = async () => {
    if (saving.current) return false;
    saving.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveOnboardingPreferences(settings, baseline);
      return true;
    } catch (error) {
      setSaveError(`Could not save your choices: ${String(error instanceof Error ? error.message : error)} Your choices are still available.`);
      return false;
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };
  const reload = () => {
    if (saving.current) return;
    const committed = captureOnboardingPreferences();
    setBaseline(committed);
    setSettings(structuredClone(committed));
    setSaveError(null);
  };
  return { settings, setSettings, isSaving, saveError, save, reload };
}
