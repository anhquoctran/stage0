import { type FC } from 'react';

export const SquareCode: FC<React.SVGProps<SVGSVGElement>> = ({ className = '', ...props }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`inline-block ${className}`}
    aria-hidden="true"
    {...props}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="m10 10-2 2 2 2" />
    <path d="m14 14 2-2-2-2" />
  </svg>
);
