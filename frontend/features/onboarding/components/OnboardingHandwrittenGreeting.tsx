import { useId, useRef } from 'react';
import { GREETING_ARTWORK } from '../constants/greetingArtwork';
import { useGreetingHandwriting } from '../hooks/useGreetingHandwriting';
import type { OnboardingHandwrittenGreetingProps } from '../types/OnboardingHandwrittenGreetingProps';

export function OnboardingHandwrittenGreeting({ language, label }: OnboardingHandwrittenGreetingProps) {
  const id = useId();
  const svg = useRef<SVGSVGElement>(null);
  const artwork = GREETING_ARTWORK[language];
  useGreetingHandwriting(svg, language);

  return (
    <svg
      ref={svg}
      viewBox="0 0 416 220"
      lang={language}
      aria-hidden="true"
      data-greeting-language={language}
      className="onboarding-hello-art h-full w-full"
    >
      <title>{label}</title>
      {artwork.attribution && <metadata>{artwork.attribution}</metadata>}
      <defs>
        <linearGradient id={`${id}-color`} x1="40" y1="170" x2="376" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fb923c" />
          <stop offset=".32" stopColor="#f472b6" />
          <stop offset=".65" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
        <mask id={`${id}-ink`} maskUnits="userSpaceOnUse" x="0" y="0" width="416" height="220">
          <g fill="none" stroke="white" strokeWidth={artwork.strokeWidth} strokeLinecap="round" strokeLinejoin="round">
            {artwork.strokes.map((stroke, index) => (
              <path
                key={index}
                data-handwriting-stroke
                className="onboarding-hello-pen"
                pathLength="1"
                d={stroke.d}
                transform={stroke.transform}
              />
            ))}
          </g>
        </mask>
      </defs>
      <rect width="416" height="220" fill={`url(#${id}-color)`} mask={`url(#${id}-ink)`} />
    </svg>
  );
}
