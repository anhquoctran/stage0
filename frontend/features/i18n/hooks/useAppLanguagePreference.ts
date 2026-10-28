import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';
import { preferencesJsonService } from '../../preferences/services/preferencesJsonService';
import type { PreferenceBootstrap } from '../../preferences/types/PreferenceBootstrap';
import { DEFAULT_APP_LANGUAGE } from '../constants/defaultLanguages';
import { applyAppLanguage } from '../services/applyAppLanguage';
import { applyDocumentDirection } from '../utils/applyDocumentDirection';
import { isAppLanguage } from '../utils/language';

/** Native windows apply locale only after Rust has persisted and broadcast it. */
export function useAppLanguagePreference() {
  const { t, i18n } = useTranslation();
  const services = useApplicationServices();
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedLanguage = i18n.resolvedLanguage ?? i18n.language;
  const language = isAppLanguage(resolvedLanguage) ? resolvedLanguage : DEFAULT_APP_LANGUAGE;

  async function changeLanguage(value: string): Promise<void> {
    if (inFlight.current || value === language || !isAppLanguage(value)) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const result = await preferencesJsonService.patch({ appearance: { language: value } });
      if (!services.platform.capabilities.backend) {
        applyDocumentDirection(value);
        await applyAppLanguage(value);
      }
      if (result.settings) window.__STAGE0_PREFERENCES__ = result.settings as PreferenceBootstrap;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('preferences.language.saveError'));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return { language, saving, error, changeLanguage };
}
