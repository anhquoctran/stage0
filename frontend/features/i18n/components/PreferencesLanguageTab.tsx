import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import { preferencesJsonService } from '../../preferences/services/preferencesJsonService';
import type { PreferenceBootstrap } from '../../preferences/types/PreferenceBootstrap';
import { DEFAULT_AGENT_OUTPUT_LANGUAGE } from '../constants/defaultLanguages';
import { SUPPORTED_LANGUAGES } from '../constants/supportedLanguages';
import type { AgentOutputLanguage } from '../types/AgentOutputLanguage';
import { applyAppLanguage } from '../services/applyAppLanguage';
import { applyDocumentDirection } from '../utils/applyDocumentDirection';

function savedAgentLanguage(settings: PreferenceBootstrap | undefined): AgentOutputLanguage {
  const value = settings?.ai?.agentOutputLanguage;
  return typeof value === 'string' && (value === 'follow-app' || SUPPORTED_LANGUAGES.some((item) => item.code === value))
    ? value as AgentOutputLanguage
    : DEFAULT_AGENT_OUTPUT_LANGUAGE;
}

export function PreferencesLanguageTab() {
  const { t, i18n } = useTranslation();
  const [agentLanguage, setAgentLanguage] = useState(() => savedAgentLanguage(window.__STAGE0_PREFERENCES__));
  const [savingAppLanguage, setSavingAppLanguage] = useState(false);
  const [savingAgentLanguage, setSavingAgentLanguage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appLanguage = i18n.resolvedLanguage ?? i18n.language;
  const services = getApplicationServices();

  useEffect(() => {
    const refresh = (event: Event) => {
      const settings = (event as CustomEvent<PreferenceBootstrap>).detail;
      setAgentLanguage(savedAgentLanguage(settings));
    };
    window.addEventListener('stage0-preferences-updated', refresh);
    return () => window.removeEventListener('stage0-preferences-updated', refresh);
  }, []);

  async function changeAppLanguage(value: string) {
    if (savingAppLanguage || value === appLanguage) return;
    setSavingAppLanguage(true);
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
      setSavingAppLanguage(false);
    }
  }

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
        <select
          id="stage0-ui-language"
          value={appLanguage}
          disabled={savingAppLanguage}
          onChange={(event) => void changeAppLanguage(event.target.value)}
          className="w-full rounded-sm border border-surface1 bg-mantle px-3 py-2 text-sm text-text disabled:opacity-60"
        >
          <optgroup label={t('preferences.language.baseGroup')}>
            {SUPPORTED_LANGUAGES.filter((language) => language.group === 'base').map((language) => (
              <option key={language.code} value={language.code}>{language.nativeName}</option>
            ))}
          </optgroup>
          <optgroup label={t('preferences.language.extendedGroup')}>
            {SUPPORTED_LANGUAGES.filter((language) => language.group === 'extended').map((language) => (
              <option key={language.code} value={language.code}>{language.nativeName}</option>
            ))}
          </optgroup>
        </select>
        {savingAppLanguage && <p role="status" className="mt-1 text-xs text-subtext0">{t('preferences.language.saving')}</p>}
      </div>

      <div>
        <label htmlFor="stage0-agent-language" className="mb-1 block text-sm font-semibold text-text">
          {t('preferences.language.agentLabel')}
        </label>
        <p className="mb-2 text-xs text-subtext0">{t('preferences.language.agentDescription')}</p>
        <select
          id="stage0-agent-language"
          value={agentLanguage}
          disabled={savingAgentLanguage}
          onChange={(event) => void changeAgentLanguage(event.target.value)}
          className="w-full rounded-sm border border-surface1 bg-mantle px-3 py-2 text-sm text-text disabled:opacity-60"
        >
          <option value="follow-app">{t('preferences.language.followApp')}</option>
          {SUPPORTED_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>{language.nativeName}</option>
          ))}
        </select>
        {savingAgentLanguage && <p role="status" className="mt-1 text-xs text-subtext0">{t('preferences.language.saving')}</p>}
      </div>
      {error && <p role="alert" className="text-xs text-red">{error}</p>}
    </section>
  );
}
