import type { FC, SVGProps } from 'react';

export const AnthropicIcon: FC<SVGProps<SVGSVGElement>> = ({ className = '', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={`inline-block ${className}`}
    aria-hidden="true"
    {...props}
  >
    <path d="M17.34 4.5h-3.32l5.66 15h3.32zM6.66 19.5h3.34L13.32 11h-3.34zm6.66-12.78L9.08 15.5h3.34l2.42-5.92zM3 19.5h3.12L3 11.22z" />
  </svg>
);
