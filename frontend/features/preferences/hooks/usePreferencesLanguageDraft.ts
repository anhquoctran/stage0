import { useEffect, useState } from 'react';
import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import { DEFAULT_AGENT_OUTPUT_LANGUAGE, DEFAULT_APP_LANGUAGE } from '../../i18n/constants/defaultLanguages';
import { readLanguagePreferences } from '../../i18n/services/languagePreferences';
import { applyAppLanguage } from '../../i18n/services/applyAppLanguage';
import { applyDocumentDirection } from '../../i18n/utils/applyDocumentDirection';
import i18n from '../../i18n/i18n';

/** Isolated language drafts have no locale, document direction or persistence effects. */
export function usePreferencesLanguageDraft(isOpen: boolean) {
  const [baseline, setBaseline] = useState(() => readLanguagePreferences());
  const [value, setValue] = useState(() => readLanguagePreferences());
  const [loading, setLoading] = useState(isOpen && typeof window !== 'undefined');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let disposed = false;
    const seed = (next: typeof baseline) => { setBaseline(next); setValue(next); };
    seed(readLanguagePreferences());
    setError(null);
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }
    const services = getApplicationServices();
    if (!services.platform.capabilities.preferencesFile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // Read only the saved language fields. Do not publish a full preference load
    // over another tab's unsaved appearance preview or overwrite edits on re-render.
    void services.preferences.loadPreferencesJson().then((document) => {
      if (disposed) return;
      if (document.validationError || !document.settings) {
        throw new Error(document.validationError || i18n.t('preferences.language.loadError'));
      }
      seed(readLanguagePreferences(document.settings));
    }).catch((cause) => {
      if (!disposed) setError(cause instanceof Error ? cause.message : i18n.t('preferences.language.loadError'));
    }).finally(() => {
      if (!disposed) setLoading(false);
    });
    return () => { disposed = true; };
  }, [isOpen]);

  const acceptCommitted = async () => {
    const committed = readLanguagePreferences();
    if (committed.uiLanguage !== baseline.uiLanguage && !getApplicationServices().platform.capabilities.backend) {
      applyDocumentDirection(committed.uiLanguage);
      await applyAppLanguage(committed.uiLanguage);
    }
    setBaseline(committed);
    setValue(committed);
    setError(null);
  };

  return {
    baseline, value, setValue, loading, error, acceptCommitted,
    changeCount: Number(value.uiLanguage !== baseline.uiLanguage) +
      Number(value.agentOutputLanguage !== baseline.agentOutputLanguage),
    discard: () => setValue(baseline),
    reset: () => setValue({ uiLanguage: DEFAULT_APP_LANGUAGE, agentOutputLanguage: DEFAULT_AGENT_OUTPUT_LANGUAGE }),
  };
}
