import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Code2,
  GitBranch,
  GitCompare,
  GitPullRequest,
  ShieldCheck,
  Sparkles,
  X,
} from '@/common/components/icons';
import { AppLogo } from '../../../common/components/AppLogo';
import { useGitStore } from '../../git/store/useGitStore';

const ONBOARDING_STORAGE_KEY = 'stage0_first_launch_welcome_v1';

export function shouldShowFirstLaunchWelcome(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'completed';
  } catch {
    return true;
  }
}

interface FirstLaunchWelcomeProps {
  onComplete: () => void;
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

const BranchArtwork: React.FC = () => (
  <div className="relative w-full max-w-[25rem] aspect-[1.35] border border-surface1 bg-base shadow-xl overflow-hidden">
    <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(var(--ctp-surface1) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 296" fill="none" aria-hidden="true">
      <path d="M75 75H135C162 75 158 128 194 128H327" stroke="var(--ctp-overlay1)" strokeWidth="3" />
      <path d="M75 220H135C162 220 158 167 194 167H327" stroke="var(--ctp-overlay1)" strokeWidth="3" />
      <path d="M194 128V167" stroke="var(--ctp-mauve)" strokeWidth="3" strokeDasharray="5 5" />
      <circle cx="75" cy="75" r="8" fill="var(--ctp-blue)" />
      <circle cx="75" cy="220" r="8" fill="var(--ctp-green)" />
      <circle cx="327" cy="128" r="8" fill="var(--ctp-mauve)" />
    </svg>
    <div className="absolute left-[10%] top-[18%] border border-surface1 bg-mantle px-3 py-2 text-[11px] font-mono text-text shadow-lg">
      <span className="mr-2 inline-block h-2 w-2 bg-blue" />main
    </div>
    <div className="absolute left-[10%] bottom-[16%] border border-surface1 bg-mantle px-3 py-2 text-[11px] font-mono text-text shadow-lg">
      <span className="mr-2 inline-block h-2 w-2 bg-green" />feature/login
    </div>
    <div className="absolute right-[7%] top-[35%] flex items-center gap-2 border border-primary/40 bg-mantle px-3 py-2 text-[11px] font-semibold text-text shadow-lg">
      <GitCompare className="h-3.5 w-3.5 text-primary" />
      Compare
    </div>
    <div className="absolute bottom-3 right-3 flex items-center gap-2 border border-surface1 bg-base/95 px-2.5 py-1.5 text-[10px] text-subtext1">
      <ShieldCheck className="h-3.5 w-3.5 text-green" />
      Working copy untouched
    </div>
  </div>
);

const CompareArtwork: React.FC = () => (
  <div className="w-full max-w-[25rem] border border-surface1 bg-base shadow-xl overflow-hidden">
    <div className="flex items-center justify-between border-b border-surface0 bg-mantle px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-text">
        <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
        Branch comparison
      </div>
      <span className="border border-yellow/30 bg-yellow/10 px-2 py-1 text-[10px] font-medium text-yellow">2 conflicts predicted</span>
    </div>
    <div className="space-y-2.5 p-4">
      {[
        { name: 'src/auth/session.ts', kind: 'Modified', additions: 3, deletions: 1 },
        { name: 'src/auth/provider.ts', kind: 'Conflict likely', additions: 2, deletions: 2 },
        { name: 'tests/session.test.ts', kind: 'Added', additions: 8, deletions: 0 },
      ].map((file) => (
        <div key={file.name} className="border border-surface0 bg-mantle px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-[11px] font-mono text-text">
              <Code2 className="h-3 w-3 shrink-0 text-subtext0" />
              <span className="truncate">{file.name}</span>
            </div>
            <span className={`shrink-0 text-[10px] ${file.kind === 'Conflict likely' ? 'text-yellow' : 'text-subtext0'}`}>{file.kind}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {Array.from({ length: file.additions }).map((_, index) => <span key={`a-${index}`} className="h-1.5 flex-1 bg-green/70" />)}
            {Array.from({ length: file.deletions }).map((_, index) => <span key={`d-${index}`} className="h-1.5 flex-1 bg-red/70" />)}
          </div>
        </div>
      ))}
    </div>
    <div className="flex items-center gap-2 border-t border-surface0 px-4 py-3 text-[11px] text-subtext1">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      Inspect each change before merging
    </div>
  </div>
);

const ReviewArtwork: React.FC = () => (
  <div className="w-full max-w-[25rem] border border-surface1 bg-base shadow-xl overflow-hidden">
    <div className="flex items-center justify-between border-b border-surface0 bg-mantle px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-text">
        <GitPullRequest className="h-4 w-4 text-primary" />
        Virtual MR
      </div>
      <span className="border border-green/30 bg-green/10 px-2 py-1 text-[10px] text-green">Local draft</span>
    </div>
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-2 h-2 w-2/3 bg-subtext1/60" />
        <div className="h-1.5 w-full bg-surface0" />
        <div className="mt-1.5 h-1.5 w-4/5 bg-surface0" />
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] text-primary">feature</span>
        <span className="border border-blue/30 bg-blue/10 px-2 py-1 text-[10px] text-blue">ready for review</span>
      </div>
      <div className="border border-surface0 bg-mantle p-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-text">
          <CheckCircle2 className="h-3.5 w-3.5 text-green" />
          Review notes
        </div>
        <div className="mt-2 h-1.5 w-full bg-surface0" />
        <div className="mt-1.5 h-1.5 w-3/4 bg-surface0" />
      </div>
    </div>
    <div className="flex items-center justify-between border-t border-surface0 px-4 py-3 text-[10px] text-subtext0">
      <span>Saved on this device</span>
      <GitBranch className="h-3.5 w-3.5 text-subtext1" />
    </div>
  </div>
);

const ARTWORK = [BranchArtwork, CompareArtwork, ReviewArtwork];

export const FirstLaunchWelcome: React.FC<FirstLaunchWelcomeProps> = ({ onComplete }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    skipRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-launch-title"
        aria-describedby="first-launch-description"
        className="grid h-full w-full grid-cols-1 overflow-hidden md:grid-cols-[1.05fr_0.95fr]"
      >
        <button
          ref={skipRef}
          type="button"
          onClick={finish}
          aria-label="Close welcome guide"
          title="Close welcome guide"
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center border border-transparent text-subtext0 transition-colors hover:border-surface1 hover:bg-surface0 hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:right-6 sm:top-6"
        >
          <X className="h-4 w-4" />
        </button>

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
              {activeSlide < SLIDES.length - 1 ? (
                <button type="button" onClick={finish} className="text-xs text-subtext0 transition-colors hover:text-text">Skip intro</button>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3">
              {activeSlide > 0 ? (
                <button type="button" onClick={() => setActiveSlide((slide) => slide - 1)} className="h-10 border border-surface1 px-4 text-xs font-medium text-subtext1 transition-colors hover:bg-surface0 hover:text-text">Back</button>
              ) : (
                <span className="text-[11px] text-subtext0">A quick 3-step tour</span>
              )}
              {activeSlide < SLIDES.length - 1 ? (
                <button type="button" onClick={() => setActiveSlide((slide) => slide + 1)} className="flex h-10 items-center gap-2 bg-primary px-4 text-xs font-semibold text-on-accent transition-colors hover:brightness-110">
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
