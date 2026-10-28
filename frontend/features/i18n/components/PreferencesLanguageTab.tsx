import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { preferencesJsonService } from '../../preferences/services/preferencesJsonService';
import type { PreferenceBootstrap } from '../../preferences/types/PreferenceBootstrap';
import { DEFAULT_AGENT_OUTPUT_LANGUAGE } from '../constants/defaultLanguages';
import { SUPPORTED_LANGUAGES } from '../constants/supportedLanguages';
import type { AgentOutputLanguage } from '../types/AgentOutputLanguage';
import { useAppLanguagePreference } from '../hooks/useAppLanguagePreference';

function savedAgentLanguage(settings: PreferenceBootstrap | undefined): AgentOutputLanguage {
  const value = settings?.ai?.agentOutputLanguage;
  return typeof value === 'string' && (value === 'follow-app' || SUPPORTED_LANGUAGES.some((item) => item.code === value))
    ? value as AgentOutputLanguage
    : DEFAULT_AGENT_OUTPUT_LANGUAGE;
}

export function PreferencesLanguageTab() {
  const { t } = useTranslation();
  const appLanguage = useAppLanguagePreference();
  const [agentLanguage, setAgentLanguage] = useState(() => savedAgentLanguage(window.__STAGE0_PREFERENCES__));
  const [savingAgentLanguage, setSavingAgentLanguage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uiLanguageOptions: CustomSelectOption<string>[] = SUPPORTED_LANGUAGES.map((language) => ({
    value: language.code,
    label: language.nativeName,
    group: t(language.group === 'base'
      ? 'preferences.language.baseGroup'
      : 'preferences.language.extendedGroup'),
  }));
  const agentLanguageOptions: CustomSelectOption<string>[] = [
    { value: 'follow-app', label: t('preferences.language.followApp') },
    ...SUPPORTED_LANGUAGES.map((language) => ({
      value: language.code,
      label: language.nativeName,
      group: t(language.group === 'base'
        ? 'preferences.language.baseGroup'
        : 'preferences.language.extendedGroup'),
    })),
  ];

  useEffect(() => {
    const refresh = (event: Event) => {
      const settings = (event as CustomEvent<PreferenceBootstrap>).detail;
      setAgentLanguage(savedAgentLanguage(settings));
    };
    window.addEventListener('stage0-preferences-updated', refresh);
    return () => window.removeEventListener('stage0-preferences-updated', refresh);
  }, []);

  async function changeAgentLanguage(value: string) {
    if (savingAgentLanguage || value === agentLanguage) return;
    setSavingAgentLanguage(true);
    setError(null);
    try {
      const result = await preferencesJsonService.patch({ ai: { agentOutputLanguage: value } });
      setAgentLanguage(value as AgentOutputLanguage);
      if (result.settings) window.__STAGE0_PREFERENCES__ = result.settings as PreferenceBootstrap;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('preferences.language.saveError'));
    } finally {
      setSavingAgentLanguage(false);
    }
  }

  return (
    <section className="space-y-6 animate-in fade-in duration-100">
      <div>
        <label htmlFor="stage0-ui-language" className="mb-1 block text-sm font-semibold text-text">
          {t('preferences.language.uiLabel')}
        </label>
        <p className="mb-2 text-xs text-subtext0">{t('preferences.language.uiDescription')}</p>
        <CustomSelect
          id="stage0-ui-language"
          value={appLanguage.language}
          disabled={appLanguage.saving}
          onChange={(value) => void appLanguage.changeLanguage(value)}
          options={uiLanguageOptions}
          className="w-full"
          buttonClassName="w-full bg-mantle px-3 py-2 text-sm"
          dropdownWidth="w-full"
          align="left"
          aria-label={t('preferences.language.uiLabel')}
        />
        {appLanguage.saving && <p role="status" className="mt-1 text-xs text-subtext0">{t('preferences.language.saving')}</p>}
      </div>

      <div>
        <label htmlFor="stage0-agent-language" className="mb-1 block text-sm font-semibold text-text">
          {t('preferences.language.agentLabel')}
        </label>
        <p className="mb-2 text-xs text-subtext0">{t('preferences.language.agentDescription')}</p>
        <CustomSelect
          id="stage0-agent-language"
          value={agentLanguage}
          disabled={savingAgentLanguage}
          onChange={(value) => void changeAgentLanguage(value)}
          options={agentLanguageOptions}
          className="w-full"
          buttonClassName="w-full bg-mantle px-3 py-2 text-sm"
          dropdownWidth="w-full"
          align="left"
          aria-label={t('preferences.language.agentLabel')}
        />
        {savingAgentLanguage && <p role="status" className="mt-1 text-xs text-subtext0">{t('preferences.language.saving')}</p>}
      </div>
      {(appLanguage.error || error) && <p role="alert" className="text-xs text-red">{appLanguage.error || error}</p>}
    </section>
  );
}
