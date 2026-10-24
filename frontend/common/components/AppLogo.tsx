import React from 'react';
import type { AppLogoProps } from '../types/AppLogoProps';

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-5 h-5',
  md: 'w-12 h-12',
  lg: 'w-20 h-20',
};

/**
 * AppLogo Component
 * Stage0 official brand logo: macOS-style squircle in Electric Violet (#9333ea) with Git branch glyph.
 */
export const AppLogo: React.FC<AppLogoProps> = ({ size = 'md', className = '' }) => {
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={`${sizeClass} shrink-0 select-none ${className}`.trim()}
      role="img"
      aria-label="Stage0"
    >
      <title>Stage0</title>
      <rect width="512" height="512" rx="143.36" fill="#9333ea" />
      <rect
        x="4"
        y="4"
        width="504"
        height="504"
        rx="139.36"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.2"
        strokeWidth="4"
      />
      <g fill="none" strokeLinecap="round">
        <path d="M352 208 A144 144 0 0 1 208 352" stroke="#e4e4e7" strokeWidth="32" />
        <path d="M160 112 V304" stroke="#ffffff" strokeWidth="32" />
        <circle cx="352" cy="160" r="48" stroke="#e4e4e7" strokeWidth="32" />
        <circle cx="160" cy="352" r="48" stroke="#ffffff" strokeWidth="32" />
      </g>
    </svg>
  );
};
