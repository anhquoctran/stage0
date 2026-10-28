import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { SUPPORTED_LANGUAGES } from '../constants/supportedLanguages';
import { isAppLanguage } from '../utils/language';
import type { PreferencesLanguageTabProps } from '../types/PreferencesLanguageTabProps';

export function PreferencesLanguageTab({ value, onChange, disabled, error }: PreferencesLanguageTabProps) {
  const { t } = useTranslation();
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

  return (
    <section className="space-y-6 animate-in fade-in duration-100">
      <div>
        <label htmlFor="stage0-ui-language" className="mb-1 block text-sm font-semibold text-text">
          {t('preferences.language.uiLabel')}
        </label>
        <p className="mb-2 text-xs text-subtext0">{t('preferences.language.uiDescription')}</p>
        <CustomSelect
          id="stage0-ui-language"
          value={value.uiLanguage}
          disabled={disabled}
          onChange={(language) => {
            if (isAppLanguage(language)) onChange((previous) => ({ ...previous, uiLanguage: language }));
          }}
          options={uiLanguageOptions}
          className="w-full"
          buttonClassName="w-full bg-mantle px-3 py-2 text-sm"
          dropdownWidth="w-full"
          align="left"
          aria-label={t('preferences.language.uiLabel')}
        />
      </div>

      <div>
        <label htmlFor="stage0-agent-language" className="mb-1 block text-sm font-semibold text-text">
          {t('preferences.language.agentLabel')}
        </label>
        <p className="mb-2 text-xs text-subtext0">{t('preferences.language.agentDescription')}</p>
        <CustomSelect
          id="stage0-agent-language"
          value={value.agentOutputLanguage}
          disabled={disabled}
          onChange={(language) => {
            if (language === 'follow-app' || isAppLanguage(language)) {
              onChange((previous) => ({ ...previous, agentOutputLanguage: language }));
            }
          }}
          options={agentLanguageOptions}
          className="w-full"
          buttonClassName="w-full bg-mantle px-3 py-2 text-sm"
          dropdownWidth="w-full"
          align="left"
          aria-label={t('preferences.language.agentLabel')}
        />
      </div>
      {disabled && <p role="status" className="text-xs text-subtext0">{t('preferences.language.loading')}</p>}
      {error && <p role="alert" className="text-xs text-red">{error}</p>}
    </section>
  );
}
