import { BotReviewer, BotCategory } from '../types/virtualMr';

export const BOT_CATEGORIES: { id: BotCategory; label: string; color: string; bg: string }[] = [
  { id: 'security', label: 'Security', color: 'var(--ctp-yellow)', bg: 'bg-yellow/10 text-yellow border-yellow/20' },
  { id: 'performance', label: 'Performance', color: 'var(--ctp-green)', bg: 'bg-green/10 text-green border-green/20' },
  { id: 'architecture', label: 'Architecture', color: 'var(--ctp-mauve)', bg: 'bg-mauve/10 text-mauve border-mauve/20' },
  { id: 'test', label: 'Bug Hunter', color: 'var(--ctp-red)', bg: 'bg-red/10 text-red border-red/20' },
  { id: 'style', label: 'Code Style', color: 'var(--ctp-blue)', bg: 'bg-blue/10 text-blue border-blue/20' },
  { id: 'documentation', label: 'Documentation', color: 'var(--ctp-teal)', bg: 'bg-teal/10 text-teal border-teal/20' },
  { id: 'custom', label: 'Custom', color: 'var(--ctp-pink)', bg: 'bg-pink/10 text-pink border-pink/20' },
];

export const DEFAULT_BOT_REVIEWERS: BotReviewer[] = [];
