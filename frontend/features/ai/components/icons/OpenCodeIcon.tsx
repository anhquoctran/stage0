import type { FC, SVGProps } from 'react';

export const OpenCodeIcon: FC<SVGProps<SVGSVGElement>> = ({ className = '', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={`inline-block ${className}`}
    aria-hidden="true"
    {...props}
  >
    <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-5 13H6V8h8v8zm4 0h-2V8h2v8z" />
  </svg>
);
