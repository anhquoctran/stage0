import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from '../../../common/components/icons/ChevronDown';
import { Check } from '../../../common/components/icons/Check';
import { useOutsideDismiss } from '../../../common/hooks/useOutsideDismiss';
import { SUPPORTED_LANGUAGES } from '../../i18n/constants/supportedLanguages';
import { languageFor } from '../../i18n/utils/language';
import type { AppLanguage } from '../../i18n/types/AppLanguage';
import type { OnboardingLanguagePickerProps } from '../types/OnboardingLanguagePickerProps';

const ROW_HEIGHT = 44;

/** A flat language dropdown with a scroll-snapping wheel and one keyboard stop. */
export function OnboardingLanguagePicker({ value, disabled, onChange }: OnboardingLanguagePickerProps) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useOutsideDismiss(container, open, () => setOpen(false));

  useEffect(() => {
    if (!open || disabled) return;
    const selected = SUPPORTED_LANGUAGES.findIndex((language) => language.code === value);
    setActiveIndex(selected);
    if (list.current) {
      list.current.scrollTop = selected * ROW_HEIGHT;
      list.current.focus({ preventScroll: true });
    }
    // External language changes (another window) reposition the same picker.
  }, [open, disabled, value]);

  useEffect(() => () => clearTimeout(scrollTimer.current), []);

  const close = () => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const select = (language: AppLanguage) => {
    if (disabled) return;
    close();
    onChange(language);
  };
  const moveTo = (index: number) => {
    const next = Math.max(0, Math.min(SUPPORTED_LANGUAGES.length - 1, index));
    setActiveIndex(next);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    list.current?.scrollTo({ top: next * ROW_HEIGHT, behavior: reducedMotion ? 'instant' : 'smooth' });
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveTo(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      moveTo(event.key === 'Home' ? 0 : SUPPORTED_LANGUAGES.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(SUPPORTED_LANGUAGES[activeIndex].code);
    }
  };

  return (
    <div ref={container} className="relative z-20 rounded-sm">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-label={t('onboarding.hello.languageLabel')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex min-h-11 items-center gap-2.5 rounded-sm border-0 bg-transparent px-4 text-base font-medium text-text transition-opacity hover:opacity-70 disabled:opacity-40"
      >
        <span lang={value} dir="auto">{languageFor(value).nativeName}</span>
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 text-subtext0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && (
        <div className="absolute start-1/2 top-full mt-2 w-64 -translate-x-1/2 rounded-sm bg-base rtl:translate-x-1/2">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-[88px] h-11 rounded-sm bg-text/5" />
          <div
            id={id}
            ref={list}
            role="listbox"
            tabIndex={0}
            aria-label={t('onboarding.hello.languageLabel')}
            aria-activedescendant={`${id}-${SUPPORTED_LANGUAGES[activeIndex].code}`}
            onKeyDown={handleKeyDown}
            onScroll={() => {
              clearTimeout(scrollTimer.current);
              scrollTimer.current = setTimeout(() => {
                const index = Math.round((list.current?.scrollTop ?? 0) / ROW_HEIGHT);
                setActiveIndex(Math.max(0, Math.min(SUPPORTED_LANGUAGES.length - 1, index)));
              }, 120);
            }}
            className="onboarding-language-wheel relative h-[220px] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-sm py-[88px] text-center"
          >
            {SUPPORTED_LANGUAGES.map((language) => (
              <button
                id={`${id}-${language.code}`}
                key={language.code}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={value === language.code}
                onClick={() => select(language.code)}
                className={`relative flex h-11 w-full shrink-0 snap-center items-center justify-center rounded-sm border-0 bg-transparent px-9 text-base transition-colors ${value === language.code ? 'font-semibold text-brand' : 'text-subtext0 hover:text-text'}`}
              >
                <span lang={language.code} dir="auto">{language.nativeName}</span>
                {value === language.code && <Check aria-hidden="true" className="absolute end-5 h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
