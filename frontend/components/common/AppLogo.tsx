import React from 'react';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * AppLogo Component
 * Stage0 Official Brand Logo with brand color #b87ff4
 */
export const AppLogo: React.FC<AppLogoProps> = ({ size = 'md', className = '' }) => {
  if (size === 'sm') {
    return (
      <div
        title="Stage0"
        className={`w-5 h-5 rounded bg-[#b87ff4]/15 border border-[#b87ff4]/30 flex items-center justify-center text-[#b87ff4] shrink-0 select-none ${className}`}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <line x1="15.5" y1="8.5" x2="8.5" y2="15.5" strokeWidth="2" opacity="0.7" />
        </svg>
      </div>
    );
  }

  if (size === 'lg') {
    return (
      <div
        title="Stage0"
        className={`w-20 h-20 rounded-2xl bg-gradient-to-br from-[#b87ff4]/20 via-[#b87ff4]/10 to-surface0 border border-[#b87ff4]/40 flex flex-col items-center justify-center text-[#b87ff4] gap-1.5 shrink-0 select-none ${className}`}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <line x1="16" y1="8" x2="8" y2="16" strokeWidth="2" opacity="0.65" />
          <circle cx="12" cy="4" r="1.5" fill="currentColor" />
          <circle cx="12" cy="20" r="1.5" fill="currentColor" />
        </svg>
        <span className="text-[10px] font-mono font-bold tracking-wider text-[#b87ff4] uppercase">Stage0</span>
      </div>
    );
  }

  // Default 'md' (w-12 h-12, 48x48px) used in WelcomeScreen
  return (
    <div
      title="Stage0"
      className={`w-12 h-12 rounded-xl bg-gradient-to-br from-[#b87ff4]/25 to-[#b87ff4]/5 border border-[#b87ff4]/40 flex items-center justify-center text-[#b87ff4] shrink-0 select-none ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" />
        <line x1="15.5" y1="8.5" x2="8.5" y2="15.5" strokeWidth="1.8" opacity="0.65" />
        <circle cx="12" cy="4" r="1.2" fill="currentColor" />
        <circle cx="12" cy="20" r="1.2" fill="currentColor" />
      </svg>
    </div>
  );
};
