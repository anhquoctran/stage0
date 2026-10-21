import React from 'react';
import { Bot } from '../../../common/components/icons/Bot';

interface GitLabAvatarProps {
  name: string;
  email?: string;
  avatarUrl?: string;
  isAiAgent?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

// GitLab authentic identicon color pairs (foreground & dark background)
const GITLAB_IDENTICON_PALETTES = [
  { fg: '#e24329', bg: '#3a1b24' }, // Red / Pink
  { fg: '#a27be8', bg: '#28193f' }, // Purple
  { fg: '#3f98e6', bg: '#102742' }, // Blue
  { fg: '#2da160', bg: '#0f2f1e' }, // Green
  { fg: '#df8e1d', bg: '#34230d' }, // Amber / Orange
  { fg: '#1ea9b0', bg: '#0b2b2f' }, // Teal / Cyan
  { fg: '#d0537d', bg: '#391a2b' }, // Magenta
  { fg: '#6b4fbb', bg: '#22153b' }, // Violet
];

function stringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export const GitLabAvatar: React.FC<GitLabAvatarProps> = ({
  name,
  email,
  avatarUrl,
  isAiAgent = false,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  }[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClasses} rounded-full object-cover shrink-0 ring-1 ring-surface1 ${className}`}
      />
    );
  }

  if (isAiAgent) {
    return (
      <div
        className={`${sizeClasses} rounded-full bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40 flex items-center justify-center shrink-0 ${className}`}
        title={`${name} (AI Agent)`}
      >
        <Bot className="w-3.5 h-3.5" />
      </div>
    );
  }

  // Deterministic GitLab-style 5x5 symmetric identicon
  const seed = email || name || 'gitlab-user';
  const hash = stringHash(seed);
  const palette = GITLAB_IDENTICON_PALETTES[hash % GITLAB_IDENTICON_PALETTES.length];

  // 5x5 grid with horizontal reflection (col 4 = col 0, col 3 = col 1)
  const rects: React.ReactNode[] = [];
  const cellSize = 10;

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      const sourceCol = x > 2 ? 4 - x : x;
      const bitIndex = y * 3 + sourceCol;
      const isFilled = ((hash >> bitIndex) & 1) === 1;

      if (isFilled) {
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={x * cellSize}
            y={y * cellSize}
            width={cellSize}
            height={cellSize}
            fill={palette.fg}
          />
        );
      }
    }
  }

  return (
    <div
      className={`${sizeClasses} rounded-full overflow-hidden shrink-0 ring-1 ring-surface1 shadow-xs ${className}`}
      title={name}
    >
      <svg
        viewBox="0 0 50 50"
        className="w-full h-full"
        style={{ backgroundColor: palette.bg }}
      >
        {rects}
      </svg>
    </div>
  );
};
