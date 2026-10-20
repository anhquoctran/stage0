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

const ONBOARDING_STORAGE_KEY = 'stage0_first_launch_welcome_v1';

export function shouldShowFirstLaunchWelcome(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'completed';
  } catch {
    return true;
  }
}

const SLIDES = [
  {
    eyebrow: 'A FRIENDLIER WAY TO REVIEW',
    title: 'Welcome to Stage0',
    description:
      'Understand what a branch will bring into your project before you merge it. Stage0 gives you a clear place to compare, inspect, and review.',
    caption: 'Start with two branches. Keep your working copy right where it is.',
  },
  {
    eyebrow: 'COMPARE WITH CONFIDENCE',
    title: 'Know what will change',
    description:
      'Choose a base branch and a branch to compare. Review changed files and likely merge conflicts before deciding what to do next.',
    caption:
      'Reviewing does not check out or merge branches into your working tree or Git index.',
  },
  {
    eyebrow: 'YOUR REVIEW, READY WHEN YOU ARE',
    title: 'Keep the conversation together',
    description:
      'Save a local Virtual MR with its description, labels, comments, and review notes. Come back to the same review whenever you need it.',
    caption: 'Open or clone a repository to create your first branch comparison.',
  },
];

const ARTWORK = [BranchArtwork, CompareArtwork, ReviewArtwork];

export const FirstLaunchWelcome: React.FC<FirstLaunchWelcomeProps> = ({ onComplete }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const isMac =
    isMacOS() ||
    (typeof window !== 'undefined' && window.location.search.includes('platform=mac'));
  const currentSlide = SLIDES[activeSlide];
  const Artwork = ARTWORK[activeSlide];

  const finish = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'completed');
    } catch {
      // The current window can still dismiss onboarding if storage is unavailable.
    }
    onComplete();
  };

  const minimizeWindow = () => {
    void invoke('window_minimize').catch((error) => console.warn('Minimize error:', error));
  };

  useEffect(() => {
    initialFocusRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'
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

  const openRepository = () => {
    finish();
    void useGitStore.getState().openRepoDialog();
  };

  const cloneRepository = () => {
    finish();
    useGitStore.getState().setIsCloneModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-base text-text">
      <div
        data-tauri-drag-region
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-[5] h-14 cursor-move"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-launch-title"
        aria-describedby="first-launch-description"
        className="grid h-full w-full grid-cols-1 overflow-hidden md:grid-cols-[1.05fr_0.95fr]"
      >
        {!isMac && (
          <div className="absolute right-4 top-4 z-10 flex items-center sm:right-6 sm:top-6">
            <button
              type="button"
              onClick={minimizeWindow}
              aria-label="Minimize window"
              title="Minimize window"
              className="flex h-10 w-10 items-center justify-center border border-transparent text-subtext0 transition-colors hover:border-surface1 hover:bg-surface0 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
              className="flex h-10 w-10 items-center justify-center border border-transparent text-subtext0 transition-colors hover:border-surface1 hover:bg-surface0 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="flex min-h-0 flex-col overflow-y-auto px-6 py-8 sm:px-10 sm:py-10 lg:px-16 lg:py-14">
          <div className="flex items-center gap-3">
            <AppLogo size="md" />
            <div>
              <div className="text-sm font-semibold tracking-tight">Stage0</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-subtext0">Virtual MR Sandbox</div>
            </div>
          </div>

          <div key={activeSlide} className="stage0-onboarding-slide mt-10 flex-1 lg:mt-16">
            <div className="mb-3 text-[10px] font-semibold tracking-[0.16em] text-primary">{currentSlide.eyebrow}</div>
            <h1 id="first-launch-title" className="max-w-md text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {currentSlide.title}
            </h1>
            <p id="first-launch-description" className="mt-4 max-w-lg text-sm leading-6 text-subtext1 sm:text-[15px]">
              {currentSlide.description}
            </p>
            <div className="mt-5 flex items-start gap-2.5 border-l-2 border-primary/60 pl-3 text-xs leading-5 text-subtext0">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{currentSlide.caption}</span>
            </div>
          </div>

          <div className="mt-8 border-t border-surface0 pt-5 lg:mt-12 lg:pt-7">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2" aria-label={`Slide ${activeSlide + 1} of ${SLIDES.length}`}>
                {SLIDES.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    onClick={() => setActiveSlide(index)}
                    aria-label={`Go to slide ${index + 1}: ${slide.title}`}
                    aria-current={index === activeSlide ? 'step' : undefined}
                    className={`h-1.5 transition-all ${index === activeSlide ? 'w-8 bg-primary' : 'w-3 bg-surface2 hover:bg-subtext0'}`}
                  />
                ))}
                <span className="ml-1 text-[10px] font-mono text-subtext0">0{activeSlide + 1} / 0{SLIDES.length}</span>
              </div>
              <button
                type="button"
                onClick={finish}
                tabIndex={-1}
                className="text-xs text-subtext0 transition-colors hover:text-text"
              >
                Skip tour
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              {activeSlide > 0 ? (
                <button type="button" onClick={() => setActiveSlide((slide) => slide - 1)} className="h-10 border border-surface1 px-4 text-xs font-medium text-subtext1 transition-colors hover:bg-surface0 hover:text-text">Back</button>
              ) : (
                <span className="text-[11px] text-subtext0">A quick 3-step tour</span>
              )}
              {activeSlide < SLIDES.length - 1 ? (
                <button ref={isMac ? initialFocusRef : undefined} type="button" onClick={() => setActiveSlide((slide) => slide + 1)} className="flex h-10 items-center gap-2 bg-primary px-4 text-xs font-semibold text-on-accent transition-colors hover:brightness-110">
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={cloneRepository} className="hidden h-10 border border-surface1 px-3 text-xs font-medium text-subtext1 transition-colors hover:bg-surface0 hover:text-text sm:inline-flex sm:items-center">Clone a repository</button>
                  <button type="button" onClick={openRepository} className="flex h-10 items-center gap-2 bg-primary px-4 text-xs font-semibold text-on-accent transition-colors hover:brightness-110">
                    Open a repository <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="relative hidden items-center justify-center overflow-hidden border-l border-surface0 bg-mantle p-8 lg:p-14 md:flex">
          <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(135deg, transparent 35%, var(--ctp-surface0) 100%)' }} />
          <div key={`art-${activeSlide}`} className="stage0-onboarding-slide relative z-10 w-full">
            <Artwork />
          </div>
          <div className="absolute bottom-5 left-6 flex items-center gap-2 text-[10px] text-subtext0">
            <span className="h-1.5 w-1.5 bg-primary" />
            Built for thoughtful code reviews
          </div>
        </aside>
      </div>
    </div>
  );
};
