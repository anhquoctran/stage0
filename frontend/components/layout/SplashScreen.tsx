import React, { useEffect, useState } from 'react';
import { GitMerge, ShieldCheck, Zap } from 'lucide-react';
import { AppLogo } from '../common/AppLogo';

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
      data-tauri-drag-region
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
          <div className="absolute -inset-2 bg-gradient-to-r from-blue/20 via-mauve/15 to-teal/20 rounded-3xl blur-xl animate-pulse" />
          <AppLogo size="lg" className="relative shadow-2xl" />
        </div>

        {/* Title & Tagline */}
        <div className="mb-1.5">
          <h1 className="text-2xl font-extrabold tracking-tight text-text">
            Stage<span className="text-blue">0</span>
          </h1>
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
