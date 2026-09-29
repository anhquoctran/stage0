import React from 'react';
import { Image } from 'lucide-react';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * AppLogo Component
 * Temporary placeholder for the application logo.
 * Replace the contents of this component once the official app logo is finalized.
 */
export const AppLogo: React.FC<AppLogoProps> = ({ size = 'md', className = '' }) => {
  if (size === 'sm') {
    return (
      <div
        title="App Logo (Placeholder)"
        className={`w-5 h-5 rounded border border-dashed border-surface2/80 bg-surface0/40 flex items-center justify-center text-subtext0/80 shrink-0 select-none ${className}`}
      >
        <Image className="w-3 h-3" />
      </div>
    );
  }

  if (size === 'lg') {
    return (
      <div
        title="App Logo (Placeholder)"
        className={`w-20 h-20 rounded-2xl border-2 border-dashed border-surface2/80 bg-surface0/30 flex flex-col items-center justify-center text-subtext0 gap-1.5 shrink-0 select-none ${className}`}
      >
        <Image className="w-7 h-7 text-subtext0/70" />
        <span className="text-[10px] font-mono uppercase text-subtext0/60 tracking-wider">Logo</span>
      </div>
    );
  }

  // Default 'md' (w-12 h-12, 48x48px) used in WelcomeScreen
  return (
    <div
      title="App Logo (Placeholder)"
      className={`w-12 h-12 rounded-lg border-2 border-dashed border-surface2/80 bg-surface0/30 flex items-center justify-center text-subtext0 shrink-0 select-none ${className}`}
    >
      <Image className="w-5 h-5 text-subtext0/80" />
    </div>
  );
};
