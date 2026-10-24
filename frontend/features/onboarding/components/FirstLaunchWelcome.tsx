import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowRight } from '../../../common/components/icons/ArrowRight';
import { Sparkles } from '../../../common/components/icons/Sparkles';
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

const ONBOARDING_STORAGE_KEY = 'stage0_first_launch_welcome_v1';

export function shouldShowFirstLaunchWelcome(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'completed';
  } catch {
    return true;
  }
}

const ARTWORK = [BranchArtwork, CompareArtwork, ReviewArtwork];

export const FirstLaunchWelcome: React.FC<FirstLaunchWelcomeProps> = ({ onComplete }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const { settings, setSettings, isSaving, saveError, save, reload } = useOnboardingPreferences();
  const completedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const isMac =
    isMacOS() ||
    (typeof window !== 'undefined' && window.location.search.includes('platform=mac'));
  const currentSlide = SLIDES[activeSlide];
  const Artwork = ARTWORK[activeSlide];
  const isSettingsSlide = activeSlide >= ARTWORK.length;

  const finish = async () => {
    if (completedRef.current || !(await save())) return false;
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
    initialFocusRef.current?.focus();
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
      if (event.shiftKey && document.activeElement === first) {
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
        className="absolute inset-x-0 top-0 z-5 h-14 cursor-move rounded-none"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-launch-title"
        aria-describedby="first-launch-description"
        aria-busy={isSaving}
        className={`grid h-full w-full grid-cols-1 overflow-hidden rounded-none ${isSettingsSlide ? 'md:grid-cols-[1.2fr_0.8fr]' : 'md:grid-cols-[1.05fr_0.95fr]'}`}
      >
        <fieldset disabled={isSaving} className="contents">
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
              ref={isMac ? undefined : initialFocusRef}
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

          <div key={activeSlide} className={`stage0-onboarding-slide min-h-0 flex-1 overflow-y-auto pr-1 ${isSettingsSlide ? 'mt-6' : 'mt-10 lg:mt-16'}`}>
            <div className="mb-3 text-[10px] font-semibold tracking-[0.16em] text-mauve">{currentSlide.eyebrow}</div>
            <h1 id="first-launch-title" className={`max-w-md font-semibold leading-tight tracking-tight ${isSettingsSlide ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}>
              {currentSlide.title}
            </h1>
            <p id="first-launch-description" className="mt-3 max-w-lg text-sm leading-6 text-subtext1">
              {currentSlide.description}
            </p>
            {isSettingsSlide && <div className="mt-5 rounded-sm max-sm:[&_[data-setting-row]]:flex-col max-sm:[&_[data-setting-row]]:items-stretch">
              <p className="mb-4 text-xs leading-relaxed text-subtext0">
                Optional — everything is already set up. Keep the defaults or your saved settings and continue without choosing anything.
              </p>
              <WelcomeSettingsPanel step={currentSlide.id} settings={settings} onChange={setSettings} />
              <div className="mt-5 md:hidden rounded-sm">
                <WelcomeSettingsPreview step={currentSlide.id} settings={settings} />
              </div>
            </div>}
            <div className="mt-5 flex items-start gap-2.5 border-l-2 border-primary/60 pl-3 text-xs leading-5 text-subtext0 rounded-sm">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{currentSlide.caption}</span>
            </div>
          </div>

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
                    onClick={() => setActiveSlide(index)}
                    aria-label={`Go to slide ${index + 1}: ${slide.title}`}
                    aria-current={index === activeSlide ? 'step' : undefined}
                    className={`h-1.5 transition-all rounded-sm ${index === activeSlide ? 'w-8 bg-primary' : 'w-3 bg-surface2 hover:bg-subtext0'}`}
                  />
                ))}
                <span className="ml-1 text-[10px] font-mono text-subtext0">0{activeSlide + 1} / 0{SLIDES.length}</span>
              </div>
              <button
                type="button"
                onClick={finish}
                tabIndex={-1}
                className="text-xs text-subtext0 transition-colors hover:text-text rounded-sm"
              >
                Skip tour
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              {activeSlide > 0 ? (
                <button type="button" onClick={() => setActiveSlide((slide) => slide - 1)} className="h-10 px-4 text-xs font-medium text-subtext1 transition-colors hover:bg-surface0 hover:text-text rounded-sm">Back</button>
              ) : (
                <span className="text-[11px] text-subtext0">A {SLIDES.length}-step welcome guide</span>
              )}
              {activeSlide < SLIDES.length - 1 ? (
                <button ref={isMac ? initialFocusRef : undefined} type="button" onClick={() => setActiveSlide((slide) => slide + 1)} className="btn-primary flex h-10 items-center gap-2 px-4 text-xs font-semibold rounded-sm">
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={cloneRepository} className="hidden h-10 px-3 text-xs font-medium text-subtext1 transition-colors hover:bg-surface0 hover:text-text sm:inline-flex sm:items-center rounded-sm">Clone a repository</button>
                  <button type="button" onClick={openRepository} className="btn-primary flex h-10 items-center gap-2 px-4 text-xs font-semibold rounded-sm">
                    {isSaving ? 'Saving…' : 'Open a repository'} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="relative hidden items-center justify-center overflow-hidden border-l border-surface0 bg-mantle p-8 lg:p-14 md:flex">
          <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(135deg, transparent 35%, var(--ctp-surface0) 100%)' }} />
          <div key={`art-${activeSlide}`} className="stage0-onboarding-slide relative z-10 w-full">
            {isSettingsSlide ? <WelcomeSettingsPreview step={currentSlide.id} settings={settings} /> : <Artwork />}
          </div>
          <div className="absolute bottom-5 left-6 flex items-center gap-2 text-[10px] text-subtext0">
            <span className="h-1.5 w-1.5 bg-primary" />
            Built for thoughtful code reviews
          </div>
        </aside>
        </fieldset>
      </div>
    </div>
  );
};
