import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowRight } from '../../../common/components/icons/ArrowRight';
import { X } from '../../../common/components/icons/X';
import { isMacOS } from '../../../common/utils/shortcuts';
import { AppLogo } from '../../../common/components/AppLogo';
import { useGitStore } from '../../git/store/useGitStore';
import { BranchArtwork } from './BranchArtwork';
import { CompareArtwork } from './CompareArtwork';
import { ReviewArtwork } from './ReviewArtwork';
import type { FirstLaunchWelcomeProps } from '../types/FirstLaunchWelcomeProps';
import { WELCOME_SLIDES as SLIDES } from '../constants/welcomeSlides';
import { useOnboardingPreferences } from '../hooks/useOnboardingPreferences';
import { WelcomeSettingsPanel } from './WelcomeSettingsPanel';
import { WelcomeSettingsPreview } from './WelcomeSettingsPreview';
import { WelcomeArtworkScene } from './WelcomeArtworkScene';
import { WelcomeAiSetup } from './WelcomeAiSetup';
import { useOnboardingAiSetup } from '../hooks/useOnboardingAiSetup';
import { OnboardingPreviewFit } from './OnboardingPreviewFit';
import { ScrollArea } from '../../../common/components/ScrollArea';
import { WelcomeRepositoryPreview } from './WelcomeRepositoryPreview';

const ONBOARDING_STORAGE_KEY = 'stage0_first_launch_welcome_v1';

export function shouldShowFirstLaunchWelcome(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'completed';
  } catch {
    return true;
  }
}

const ARTWORK = [BranchArtwork, CompareArtwork, ReviewArtwork];
const AI_SETUP_SLIDE = SLIDES.findIndex((slide) => slide.id === 'ai-setup');

export const FirstLaunchWelcome: React.FC<FirstLaunchWelcomeProps> = ({ onComplete }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const { settings, setSettings, isSaving, saveError, save, reload } = useOnboardingPreferences();
  const aiSetup = useOnboardingAiSetup();
  const [aiRequired, setAiRequired] = useState(false);
  const completedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isMac =
    isMacOS() ||
    (typeof window !== 'undefined' && window.location.search.includes('platform=mac'));
  const currentSlide = SLIDES[activeSlide];
  const Artwork = ARTWORK[activeSlide];
  const isAiSlide = currentSlide.id === 'ai-setup';
  const isRepositorySlide = currentSlide.id === 'repository';
  const isSettingsSlide = activeSlide >= ARTWORK.length && !isRepositorySlide;
  const isAppearanceSlide = isSettingsSlide && !isAiSlide;
  const isBusy = isSaving || aiSetup.busy;
  const requireAiSetup = () => {
    setAiRequired(true); setActiveSlide(AI_SETUP_SLIDE);
  };
  const selectSlide = (index: number) => {
    if (index > AI_SETUP_SLIDE && !aiSetup.canFinish()) { requireAiSetup(); return; }
    setActiveSlide(index);
  };

  const finish = async () => {
    if (completedRef.current || isBusy) return false;
    if (!aiSetup.canFinish()) { requireAiSetup(); return false; }
    if (!(await save())) return false;
    if (!aiSetup.canFinish()) { requireAiSetup(); return false; }
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

  const minimizeWindow = () => {
    void invoke('window_minimize').catch((error) => console.warn('Minimize error:', error));
  };

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
      const enteringDialog = document.activeElement === dialogRef.current || !dialogRef.current.contains(document.activeElement);
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

  return (
    <div className="fixed inset-0 z-200 bg-base text-text rounded-none">
      <div
        data-tauri-drag-region
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-5 h-14 cursor-default rounded-none"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-launch-title"
        aria-describedby="first-launch-description"
        aria-busy={isBusy}
        tabIndex={-1}
        className={`grid h-full w-full grid-cols-1 overflow-hidden rounded-none focus:outline-none! ${isSettingsSlide ? 'md:grid-cols-[1.2fr_0.8fr]' : 'md:grid-cols-[1.05fr_0.95fr]'}`}
      >
        <fieldset disabled={isBusy} className="contents">
        {!isMac && (
          <div className="absolute right-4 top-4 z-10 flex items-center sm:right-6 sm:top-6">
            <button
              type="button"
              onClick={minimizeWindow}
              aria-label="Minimize window"
              title="Minimize window"
              className="flex h-10 w-10 items-center justify-center text-subtext0 transition-colors hover:border-surface1 hover:bg-surface0 hover:text-text focus-visible:outline focus-visible:outline-primary rounded-none"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 6h8" stroke="currentColor" strokeWidth="1.25" />
              </svg>
            </button>
            <button
              type="button"
              onClick={finish}
              aria-label="Close welcome guide"
              title="Close welcome guide"
              className="flex h-10 w-10 items-center justify-center text-subtext0 transition-colors hover:border-surface1 hover:bg-surface0 hover:text-text focus-visible:outline focus-visible:outline-primary rounded-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="flex min-h-0 flex-col overflow-hidden px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <div className="flex items-center gap-3">
            <AppLogo size="md" />
            <div>
              <div className="text-sm font-semibold tracking-tight">Stage0</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-subtext0">Virtual MR Sandbox</div>
            </div>
          </div>

          <ScrollArea key={activeSlide} role="region" aria-label="Welcome guide content" tabIndex={0}
            contentClassName={isSettingsSlide ? '' : 'flex flex-col'}
            className={`${isAiSlide ? '' : 'stage0-onboarding-slide'} min-h-0 flex-1 pr-1 ${isSettingsSlide ? 'mt-6' : ''}`}>
            <div className={isSettingsSlide ? '' : 'my-auto py-8 lg:py-12'}>
              <div className="mb-3 text-[10px] font-semibold tracking-[0.16em] text-brand">{currentSlide.eyebrow}</div>
              <h1 id="first-launch-title" className={`max-w-lg font-semibold leading-tight tracking-tight ${isSettingsSlide ? 'text-2xl sm:text-3xl' : 'text-3xl lg:text-5xl'}`}>
                {currentSlide.title}
              </h1>
              <p id="first-launch-description" className={`mt-4 max-w-lg text-subtext1 ${isSettingsSlide ? 'text-sm leading-6' : 'text-[length:1rem] leading-7'}`}>
                {currentSlide.description}
              </p>
              {'highlights' in currentSlide && <dl className="mt-7 max-w-lg space-y-5">
                {currentSlide.highlights.map((highlight) => <div key={highlight.title} className="flex gap-3 rounded-sm">
                  <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  <div>
                    <dt className="text-sm font-semibold text-text">{highlight.title}</dt>
                    <dd className="mt-1 text-sm leading-6 text-subtext0">{highlight.description}</dd>
                  </div>
                </div>)}
              </dl>}
              {isAiSlide ? <div className="mt-5 rounded-sm">
                {aiRequired && !aiSetup.canFinish() && <p role="alert" className="mb-3 rounded-sm bg-yellow/10 p-3 text-xs leading-5 text-text">Save at least one AI connection and save or discard any AI draft before finishing onboarding.</p>}
                <WelcomeAiSetup setup={aiSetup} />
              </div> : isAppearanceSlide && <div className="mt-5 rounded-sm max-sm:[&_[data-setting-row]]:flex-col max-sm:[&_[data-setting-row]]:items-stretch">
                <p className="mb-4 text-xs leading-relaxed text-subtext0">
                  Optional — everything is already set up. Keep the defaults or your saved settings and continue without choosing anything.
                </p>
                <WelcomeSettingsPanel step={currentSlide.id} settings={settings} onChange={setSettings} />
                <div className="mt-5 md:hidden rounded-sm">
                  <WelcomeSettingsPreview step={currentSlide.id} settings={settings} />
                </div>
              </div>}
              <div className="mt-5 border-l-2 border-primary/60 pl-3 text-xs leading-5 text-subtext0 rounded-sm">
                <span>{currentSlide.caption}</span>
              </div>
            </div>
          </ScrollArea>

          <div className="mt-5 shrink-0 border-t border-surface0 pt-5">
            {saveError && <div className="mb-3 space-y-2 rounded-sm">
              <p role="alert" className="text-xs text-red">{saveError}</p>
              <button type="button" onClick={reload} title="Discard choices in this guide and reload saved settings"
                className="rounded-sm border border-surface0 px-3 py-1.5 text-xs text-subtext1 hover:bg-surface0">
                Reload saved settings
              </button>
            </div>}
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2" aria-label={`Slide ${activeSlide + 1} of ${SLIDES.length}`}>
                {SLIDES.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    onClick={() => selectSlide(index)}
                    aria-label={`Go to slide ${index + 1}: ${slide.title}`}
                    aria-current={index === activeSlide ? 'step' : undefined}
                    className={`h-1.5 transition-all rounded-sm ${index === activeSlide ? 'w-8 bg-primary' : 'w-3 bg-surface2 hover:bg-subtext0'}`}
                  />
                ))}
              </div>
              {aiSetup.connections.length > 0 && <button
                type="button"
                onClick={finish}
                tabIndex={-1}
                className="text-xs text-subtext0 transition-colors hover:text-text rounded-sm"
              >
                Skip tour
              </button>}
            </div>

            <div className="flex items-center justify-between gap-3">
              {activeSlide > 0 ? (
                <button type="button" onClick={() => setActiveSlide((slide) => slide - 1)} className="h-10 px-4 text-xs font-medium text-subtext1 transition-colors hover:bg-surface0 hover:text-text rounded-sm">Back</button>
              ) : (
                <span aria-hidden="true" />
              )}
              {activeSlide < SLIDES.length - 1 ? (
                <button type="button" disabled={isAiSlide && !aiSetup.canFinish()} onClick={() => selectSlide(activeSlide + 1)} className={`flex h-10 items-center gap-2 rounded-sm px-4 text-xs font-semibold disabled:opacity-40 ${currentSlide.id === 'review' ? 'btn-primary' : 'border-0 bg-surface0 text-text shadow-none transition-colors hover:bg-surface1'}`}>
                  {currentSlide.id === 'review' ? "Let's get started" : 'Next'} <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" onClick={cloneRepository} className="inline-flex h-10 items-center px-3 text-xs font-medium text-subtext1 transition-colors hover:bg-surface0 hover:text-text rounded-sm">Clone a repository</button>
                  <button type="button" onClick={openRepository} className="btn-primary flex h-10 items-center gap-2 px-4 text-xs font-semibold rounded-sm">
                    {isSaving ? 'Saving…' : 'Open a repository'} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="relative hidden min-h-0 flex-col overflow-hidden bg-crust px-6 pt-6 lg:px-10 md:flex">
          <div className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(var(--ctp-surface1) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <OnboardingPreviewFit key={`art-${activeSlide}`}>
            {isRepositorySlide ? <WelcomeRepositoryPreview /> : isAiSlide ? <div className="space-y-5 rounded-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">AI is at the heart of Stage0</p>
              <h2 className="text-3xl font-semibold text-text">Your model. Your workflow.</h2>
              <p className="text-sm leading-6 text-subtext1">Use a built-in LLM provider, a local Ollama model, or an external ACP agent. One saved setup unlocks the next step.</p>
              <div className="grid grid-cols-2 gap-3">
                {['LLM Provider', 'ACP Agent'].map((label) => <div key={label} className="rounded-sm bg-base p-5 text-sm font-semibold text-text">{label}</div>)}
              </div>
              <p className="text-xs leading-6 text-subtext0">Setup does not automatically start inference or share source code. Review-time consent, guardrails and evidence checks remain in place.</p>
            </div> : 'highlights' in currentSlide ? <WelcomeArtworkScene step={currentSlide.id}><Artwork /></WelcomeArtworkScene> :
              <WelcomeSettingsPreview step={currentSlide.id} settings={settings} />}
          </OnboardingPreviewFit>
          <div className="relative z-10 flex shrink-0 items-center gap-2 py-5 text-[10px] text-subtext0">
            <span className="h-1.5 w-1.5 bg-primary" />
            Built for thoughtful code reviews
          </div>
        </aside>
        </fieldset>
      </div>
    </div>
  );
};
