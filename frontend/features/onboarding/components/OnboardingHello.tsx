import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from '../../../common/components/icons/ArrowRight';
import { useAppLanguagePreference } from '../../i18n/hooks/useAppLanguagePreference';
import { OnboardingLanguagePicker } from './OnboardingLanguagePicker';
import '../styles/onboarding-hello.css';

export function OnboardingHello({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  const language = useAppLanguagePreference();
  const gradient = useId();

  return (
    <section className="onboarding-hello relative isolate flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-10 text-center sm:py-14">
      <div aria-hidden="true" className="onboarding-hello-halo pointer-events-none absolute inset-0 -z-10" />
      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <h1 id="first-launch-title" className="sr-only">{t('onboarding.hello.title')}</h1>
        <svg aria-hidden="true" viewBox="0 0 416 220" fill="none" className="onboarding-hello-art w-[min(76vw,440px)] overflow-visible">
          <defs>
            <linearGradient id={gradient} x1="40" y1="170" x2="360" y2="45" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fb923c" />
              <stop offset=".32" stopColor="#f472b6" />
              <stop offset=".65" stopColor="#a78bfa" />
              <stop offset="1" stopColor="#60a5fa" />
            </linearGradient>
          </defs>
          <path
            className="onboarding-hello-stroke"
            pathLength="1"
            stroke={`url(#${gradient})`}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M44 170 C70 145 102 70 96 46 C89 18 62 82 58 121 L49 171 C63 143 78 124 92 134 C107 145 88 170 102 174 C111 178 124 164 132 153 C154 154 176 131 160 126 C144 120 126 146 133 163 C144 192 178 171 193 151 C221 119 248 45 232 36 C218 29 191 93 188 131 C183 167 199 191 226 163 L240 145 C267 115 292 44 276 36 C260 29 236 94 234 133 C231 169 248 190 275 164 L286 148 C292 128 321 119 334 132 C350 149 331 176 314 177 C291 180 282 164 289 145 C296 127 315 124 328 135 C339 147 357 151 372 134"
          />
        </svg>
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
