import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ArrowRight } from '../../../common/components/icons/ArrowRight';
import { Check } from '../../../common/components/icons/Check';
import { AppLogo } from '../../../common/components/AppLogo';
import { ScrollArea } from '../../../common/components/ScrollArea';
import { useGitStore } from '../../git/store/useGitStore';
import type { FirstLaunchWelcomeProps } from '../types/FirstLaunchWelcomeProps';
import { WELCOME_SLIDES as SLIDES } from '../constants/welcomeSlides';
import { useOnboardingPreferences } from '../hooks/useOnboardingPreferences';
import { useOnboardingAiSetup } from '../hooks/useOnboardingAiSetup';
import { WelcomeSettingsPanel } from './WelcomeSettingsPanel';
import { WelcomeAiSetup } from './WelcomeAiSetup';
import { OnboardingReviewerSetup } from './OnboardingReviewerSetup';
import { OnboardingHello } from './OnboardingHello';
import { OnboardingWindowChrome } from './OnboardingWindowChrome';

const ONBOARDING_STORAGE_KEY = 'stage0_first_launch_welcome_v1';

export function shouldShowFirstLaunchWelcome(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'completed';
  } catch {
    return true;
  }
}

const AI_SETUP_SLIDE = SLIDES.findIndex((slide) => slide.id === 'ai-setup');
const REVIEWER_SETUP_SLIDE = SLIDES.findIndex((slide) => slide.id === 'reviewer-setup');

export const FirstLaunchWelcome: React.FC<FirstLaunchWelcomeProps> = ({ onComplete }) => {
  const { t } = useTranslation();
  const [activeSlide, setActiveSlide] = useState(0);
  const { settings, setSettings, isSaving, saveError, save, reload } = useOnboardingPreferences();
  const aiSetup = useOnboardingAiSetup();
  const [aiRequired, setAiRequired] = useState(false);
  const [aiSetupPassed, setAiSetupPassed] = useState(false);
  const completedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const currentSlide = SLIDES[activeSlide];
  const isHelloSlide = currentSlide.id === 'hello';
  const isAiSlide = currentSlide.id === 'ai-setup';
  const isReviewerSlide = currentSlide.id === 'reviewer-setup';
  const isRepositorySlide = currentSlide.id === 'repository';
  const isBusy = isSaving || aiSetup.busy;

  const hasSavedAiConnection =
    !aiSetup.busy && !aiSetup.hasChanges && (aiSetup.connections?.length ?? 0) > 0;
  const canPassAiSlide = hasSavedAiConnection || aiSetup.canFinish();

  const requireAiSetup = () => {
    setAiSetupPassed(false);
    setAiRequired(true);
    if (!canPassAiSlide) {
      setActiveSlide(AI_SETUP_SLIDE);
    } else {
      setActiveSlide(REVIEWER_SETUP_SLIDE);
    }
  };

  const selectSlide = async (index: number) => {
    if (isBusy) return;
    if (activeSlide === AI_SETUP_SLIDE && index > AI_SETUP_SLIDE && aiSetup.hasChanges) {
      await aiSetup.save();
    }
    if (activeSlide === REVIEWER_SETUP_SLIDE && index > REVIEWER_SETUP_SLIDE && aiSetup.hasChanges) {
      await aiSetup.save();
    }
    const connectionReady =
      (!aiSetup.busy && !aiSetup.hasChanges && (aiSetup.connections?.length ?? 0) > 0) ||
      aiSetup.canFinish();
    if (index > AI_SETUP_SLIDE && !connectionReady) {
      setAiSetupPassed(false);
      setAiRequired(true);
      setActiveSlide(AI_SETUP_SLIDE);
      return;
    }
    if (index > REVIEWER_SETUP_SLIDE && !aiSetup.canFinish()) {
      setAiSetupPassed(false);
      setAiRequired(true);
      setActiveSlide(REVIEWER_SETUP_SLIDE);
      return;
    }
    if (index > REVIEWER_SETUP_SLIDE && aiSetup.canFinish()) {
      setAiSetupPassed(true);
    }
    setActiveSlide(index);
  };

  const finish = async () => {
    if (isHelloSlide || completedRef.current || isBusy) return false;
    if (aiSetup.hasChanges && aiSetup.save) {
      await aiSetup.save();
    }
    if (!aiSetup.canFinish()) {
      requireAiSetup();
      return false;
    }
    if (!(await save())) return false;
    if (!aiSetup.canFinish()) {
      requireAiSetup();
      return false;
    }
    completedRef.current = true;
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'completed');
    } catch {
      // The current window can still dismiss onboarding if storage is unavailable.
    }
    onComplete();
    return true;
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        void finishRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled):not([tabindex="-1"]), select:not(:disabled):not([tabindex="-1"]), textarea:not(:disabled):not([tabindex="-1"]), [href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const enteringDialog =
        document.activeElement === dialogRef.current ||
        !dialogRef.current.contains(document.activeElement);
      if (enteringDialog) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openRepository = async () => {
    if (await finish()) void useGitStore.getState().openRepoDialog();
  };

  const cloneRepository = async () => {
    if (await finish()) useGitStore.getState().setIsCloneModalOpen(true);
  };

  const nextDisabled =
    (isAiSlide && !canPassAiSlide && !aiSetup.hasChanges) ||
    (isReviewerSlide && !aiSetup.canFinish() && !aiSetup.hasChanges);

  return (
    <div className="absolute inset-0 z-200 bg-base text-text rounded-none">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-launch-title"
        aria-describedby="first-launch-description"
        aria-busy={isBusy}
        tabIndex={-1}
        className="flex h-full w-full flex-col overflow-hidden rounded-none focus:outline-none!"
      >
        <OnboardingWindowChrome />
        <fieldset disabled={isBusy} className="contents">
          {isHelloSlide ? (
            <OnboardingHello onContinue={() => void selectSlide(activeSlide + 1)} />
          ) : <section className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden px-6 py-8 sm:px-10 sm:py-10">
            {/* Header + Horizontal Stepper */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface0 pb-5 pe-16">
              <div className="flex items-center gap-3">
                <AppLogo size="md" />
                <div>
                  <div className="text-sm font-semibold tracking-tight">Stage0</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-subtext0">
                    {t('onboarding.welcome.virtualMrSandbox')}
                  </div>
                </div>
              </div>

              <div
                className="flex flex-wrap items-center gap-1.5"
                aria-label={t('onboarding.welcome.slideCount', { current: activeSlide + 1, total: SLIDES.length })}
              >
                {SLIDES.map((slide, index) => {
                  const isActive = index === activeSlide;
                  const isCompleted = index < activeSlide;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => selectSlide(index)}
                      aria-label={t('onboarding.welcome.goToSlide', { index: index + 1, title: t(slide.title) })}
                      aria-current={isActive ? 'step' : undefined}
                      className={`flex items-center gap-1.5 rounded-sm px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? 'border-0 bg-brand text-white'
                          : isCompleted
                            ? 'border-0 bg-surface0 text-text hover:bg-surface1'
                            : 'border border-surface0 bg-crust text-subtext0 hover:text-text'
                      }`}
                    >
                      {isCompleted && <Check className="h-3 w-3 shrink-0" />}
                      <span>{t(slide.stepLabel)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Main Single-Canvas Content */}
            <ScrollArea
              key={activeSlide}
              role="region"
              aria-label={t('onboarding.welcome.guideContent')}
              tabIndex={0}
              className="mt-6 min-h-0 flex-1 pe-1"
            >
              <div className="space-y-6 pb-4">
                <div>
                  <div className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-brand">
                    {t(currentSlide.eyebrow)}
                  </div>
                  <h1
                    id="first-launch-title"
                    className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
                  >
                    {t(currentSlide.title)}
                  </h1>
                  <p
                    id="first-launch-description"
                    className="mt-2 max-w-2xl text-sm leading-6 text-subtext1"
                  >
                    {t(currentSlide.description)}
                  </p>
                </div>

                {'highlights' in currentSlide && (
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {currentSlide.highlights.map((highlight) => (
                      <div
                        key={highlight.title}
                        className="rounded-sm border border-surface0 bg-mantle/60 p-4"
                      >
                        <dt className="text-xs font-semibold text-text">{t(highlight.title)}</dt>
                        <dd className="mt-1 text-xs leading-5 text-subtext0">
                          {t(highlight.description)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}

                {aiRequired && !aiSetup.canFinish() && (isAiSlide || isReviewerSlide) && (
                  <p
                    role="alert"
                    className="rounded-sm bg-yellow/10 p-3 text-xs leading-5 text-text"
                  >
                    {t('onboarding.welcome.setupRequired')}
                  </p>
                )}

                {isAiSlide ? (
                  <WelcomeAiSetup setup={aiSetup} />
                ) : isReviewerSlide ? (
                  <OnboardingReviewerSetup
                    draftSettings={aiSetup.draft}
                    hasSavedRequiredReviewer={Boolean(aiSetup.hasSavedRequiredReviewer)}
                    onAutoSave={aiSetup.save}
                  />
                ) : (
                  <div className="rounded-sm max-sm:[&_[data-setting-row]]:flex-col max-sm:[&_[data-setting-row]]:items-stretch">
                    <WelcomeSettingsPanel
                      step={currentSlide.id}
                      settings={settings}
                      onChange={setSettings}
                    />
                  </div>
                )}

                <div className="border-s-2 border-primary/60 ps-3 text-xs leading-5 text-subtext0 rounded-sm">
                  <span>{t(currentSlide.caption)}</span>
                </div>
              </div>
            </ScrollArea>

            {/* Footer Navigation */}
            <div className="mt-4 shrink-0 border-t border-surface0 pt-4">
              {saveError && (
                <div className="mb-3 space-y-2 rounded-sm">
                  <p role="alert" className="text-xs text-red">
                    {saveError}
                  </p>
                  <button
                    type="button"
                    onClick={reload}
                    title={t('onboarding.welcome.discardChoices')}
                    className="rounded-sm border border-surface0 px-3 py-1.5 text-xs text-subtext1 hover:bg-surface0"
                  >
                    {t('onboarding.welcome.reloadSaved')}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {activeSlide > 0 ? (
                    <button
                      type="button"
                      onClick={() => setActiveSlide((slide) => slide - 1)}
                      className="h-10 rounded-sm px-4 text-xs font-medium text-subtext1 transition-colors hover:bg-surface0 hover:text-text"
                    >
                      {t('onboarding.welcome.back')}
                    </button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  {aiSetupPassed && aiSetup.canFinish() && !isAiSlide && !isReviewerSlide && (
                    <button
                      type="button"
                      onClick={finish}
                      tabIndex={-1}
                      className="rounded-sm px-2 py-1 text-xs text-subtext0 transition-colors hover:text-text"
                    >
                      {t('onboarding.welcome.skipTour')}
                    </button>
                  )}
                </div>

                {!isRepositorySlide ? (
                  <button
                    type="button"
                    disabled={nextDisabled}
                    onClick={() => selectSlide(activeSlide + 1)}
                    className="flex h-10 items-center gap-2 rounded-sm border-0 bg-brand px-4 text-xs font-semibold text-white transition-colors hover:opacity-95 disabled:opacity-40"
                  >
                    {t('common.next')} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </button>
                ) : (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={cloneRepository}
                      className="inline-flex h-10 items-center rounded-sm bg-surface0 px-3.5 text-xs font-medium text-text transition-colors hover:bg-surface1"
                    >
                      {t('onboarding.welcome.cloneRepository')}
                    </button>
                    <button
                      type="button"
                      onClick={openRepository}
                      className="btn-primary flex h-10 items-center gap-2 rounded-sm px-4 text-xs font-semibold"
                    >
                      {isSaving ? t('onboarding.welcome.saving') : t('onboarding.welcome.openRepository')}{' '}
                      <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>}
        </fieldset>
      </div>
    </div>
  );
};
