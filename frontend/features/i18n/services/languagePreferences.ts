import i18n from '../i18n';
import { DEFAULT_AGENT_OUTPUT_LANGUAGE, DEFAULT_APP_LANGUAGE } from '../constants/defaultLanguages';
import { isAppLanguage } from '../utils/language';
import type { LanguagePreferences } from '../types/LanguagePreferences';
import type { PreferenceBootstrap } from '../../preferences/types/PreferenceBootstrap';

export function readLanguagePreferences(
  settings: PreferenceBootstrap | undefined = typeof window === 'undefined' ? undefined : window.__STAGE0_PREFERENCES__,
): LanguagePreferences {
  const uiLanguage = settings?.appearance?.language;
  const agentLanguage = settings?.ai?.agentOutputLanguage;
  return {
    uiLanguage: isAppLanguage(uiLanguage) ? uiLanguage : DEFAULT_APP_LANGUAGE,
    agentOutputLanguage: agentLanguage === 'follow-app' || isAppLanguage(agentLanguage)
      ? agentLanguage : DEFAULT_AGENT_OUTPUT_LANGUAGE,
  };
}

/** Only edited fields join Apply; compare them against the latest Rust read. */
export function languagePreferencesPatch(
  draft: LanguagePreferences,
  baseline: LanguagePreferences,
  current?: LanguagePreferences,
) {
  if (!isAppLanguage(draft.uiLanguage) ||
      (draft.agentOutputLanguage !== 'follow-app' && !isAppLanguage(draft.agentOutputLanguage))) {
    throw new Error(i18n.t('preferences.language.saveError'));
  }
  for (const field of ['uiLanguage', 'agentOutputLanguage'] as const) {
    if (draft[field] === baseline[field]) continue;
    if (current && current[field] !== baseline[field] && current[field] !== draft[field]) {
      throw new Error(i18n.t('preferences.language.changedElsewhere'));
    }
  }
  return {
    ...(draft.uiLanguage !== baseline.uiLanguage ? { appearance: { language: draft.uiLanguage } } : {}),
    ...(draft.agentOutputLanguage !== baseline.agentOutputLanguage
      ? { ai: { agentOutputLanguage: draft.agentOutputLanguage } } : {}),
  };
}
