import { useTranslation } from 'react-i18next';
import { ArrowRight } from '../../../common/components/icons/ArrowRight';
import { useAppLanguagePreference } from '../../i18n/hooks/useAppLanguagePreference';
import { OnboardingLanguagePicker } from './OnboardingLanguagePicker';
import { OnboardingHandwrittenGreeting } from './OnboardingHandwrittenGreeting';
import '../styles/onboarding-hello.css';

export function OnboardingHello({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  const language = useAppLanguagePreference();

  return (
    <section className="onboarding-hello relative isolate flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-10 text-center sm:py-14">
      <div aria-hidden="true" className="onboarding-hello-halo pointer-events-none absolute inset-0 -z-10" />
      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <h1 id="first-launch-title" className="sr-only">{t('onboarding.hello.title')}</h1>
        <div key={language.language} aria-hidden="true" className="grid aspect-[416/220] w-[min(76vw,440px)] place-items-center">
          <OnboardingHandwrittenGreeting language={language.language} label={t('onboarding.hello.title')} />
        </div>
        <p className="mt-1 text-xl font-medium tracking-tight text-text sm:text-2xl">{t('onboarding.hello.welcome')}</p>
        <p id="first-launch-description" className="mt-3 max-w-xs text-sm leading-6 text-subtext0">{t('onboarding.hello.description')}</p>
        <div className="mt-6">
          <OnboardingLanguagePicker
            value={language.language}
            disabled={language.saving}
            onChange={(value) => void language.changeLanguage(value)}
          />
        </div>
        <div aria-live="polite" className="mt-2 min-h-5 max-w-sm text-xs">
          {language.saving && <p role="status" className="text-subtext0">{t('preferences.language.saving')}</p>}
          {language.error && <p role="alert" className="text-red">{language.error}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-5 pb-2 pt-8">
        <button
          type="button"
          disabled={language.saving}
          onClick={onContinue}
          className="btn-solid inline-flex h-11 min-w-40 items-center justify-center gap-8 rounded-sm border-0 bg-brand px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {t('onboarding.hello.continue')} <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
        </button>
        <span className="text-[11px] font-medium tracking-[0.2em] text-subtext0/60">Stage0</span>
      </div>
    </section>
  );
}
