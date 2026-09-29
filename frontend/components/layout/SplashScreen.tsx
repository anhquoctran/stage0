import React, { useEffect, useState } from 'react';
import { GitMerge, ShieldCheck, Zap } from 'lucide-react';

interface SplashScreenProps {
  isInitializing: boolean;
  onFinished?: () => void;
}

const LOADING_STEPS = [
  'Initializing Stage0 runtime...',
  'Checking repository cache & SQLite state...',
  'Preparing 3-dot virtual merge engine...',
  'Setting up workspace...',
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  isInitializing,
  onFinished,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isRendered, setIsRendered] = useState(true);

  // Cycle through informative loading steps smoothly
  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 450);

    return () => clearInterval(timer);
  }, []);

  // When initialization finishes, trigger smooth fade-out
  useEffect(() => {
    if (!isInitializing) {
      // Keep splash for minimum 600ms to avoid jarring flash
      const fadeTimer = setTimeout(() => {
        setIsFading(true);
        const unmountTimer = setTimeout(() => {
          setIsRendered(false);
          onFinished?.();
        }, 350);
        return () => clearTimeout(unmountTimer);
      }, 500);

      return () => clearTimeout(fadeTimer);
    }
  }, [isInitializing, onFinished]);

  if (!isRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-crust select-none transition-all duration-300 ${
        isFading ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{ backgroundColor: '#11111b' }}
    >
      {/* Subtle Background Glow Spheres */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-mauve/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="flex flex-col items-center max-w-sm px-6 text-center">
        {/* Animated App Brand Icon */}
        <div className="relative mb-6">
          {/* Pulsing Aura */}
          <div className="absolute -inset-2 bg-gradient-to-r from-blue/30 via-mauve/25 to-teal/30 rounded-3xl blur-xl animate-pulse" />

          {/* Logo Container */}
          <div className="relative w-24 h-24 rounded-2xl bg-mantle border border-surface0/80 shadow-2xl flex items-center justify-center text-blue group">
            <svg
              className="w-16 h-16 drop-shadow-md"
              viewBox="0 0 128 128"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="splash-trunk" x1="0" y1="0" x2="0" y2="128" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#89b4fa" />
                  <stop offset="100%" stopColor="#74c7ec" />
                </linearGradient>
                <linearGradient id="splash-branch" x1="44" y1="42" x2="84" y2="92" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#cba6f7" />
                  <stop offset="100%" stopColor="#a6e3a1" />
                </linearGradient>
              </defs>

              {/* Trunk line */}
              <path d="M44 26 V102" stroke="#45475a" strokeWidth="6" strokeLinecap="round" />
              <path d="M44 42 V86" stroke="url(#splash-trunk)" strokeWidth="6" strokeLinecap="round" />

              {/* Branch curve */}
              <path
                d="M44 42 C44 58, 84 52, 84 66 C84 80, 44 76, 44 92"
                stroke="url(#splash-branch)"
                strokeWidth="6"
                strokeLinecap="round"
                fill="none"
              />

              {/* Commits */}
              <circle cx="44" cy="36" r="8" fill="#1e1e2e" stroke="#89b4fa" strokeWidth="5" />
              <circle cx="44" cy="94" r="8" fill="#1e1e2e" stroke="#a6e3a1" strokeWidth="5" />
              <circle cx="84" cy="66" r="9" fill="#181825" stroke="#cba6f7" strokeWidth="5" />
              <circle cx="84" cy="66" r="4" fill="#cba6f7" />
              <circle cx="44" cy="94" r="3" fill="#a6e3a1" />
            </svg>
          </div>
        </div>

        {/* Title & Tagline */}
        <div className="flex items-center gap-2 mb-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-text">
            Stage<span className="text-blue">0</span>
          </h1>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue/15 text-blue border border-blue/30">
            Virtual MR
          </span>
        </div>

        <p className="text-xs text-subtext1 mb-6 leading-relaxed">
          Local-first Virtual Merge Request & Conflict Prediction Sandbox
        </p>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-surface0/60 rounded-full h-1.5 overflow-hidden mb-3.5 border border-surface0/40">
          <div className="h-full bg-gradient-to-r from-blue via-mauve to-green rounded-full w-2/3 animate-[splash-progress_1.6s_ease-in-out_infinite]" />
        </div>

        {/* Step indicator */}
        <div className="h-5 flex items-center justify-center">
          <span className="text-[11px] font-mono text-subtext0 transition-all duration-200">
            {LOADING_STEPS[stepIndex]}
          </span>
        </div>

        {/* Highlights Pills */}
        <div className="mt-8 flex items-center gap-4 text-[10px] text-overlay1 font-medium">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-peach" />
            <span>Zero Disk Writes</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <GitMerge className="w-3 h-3 text-teal" />
            <span>git merge-tree</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-green" />
            <span>100% Isolated</span>
          </div>
        </div>
      </div>
    </div>
  );
};
