import { BotReviewer, BotCategory } from '../types/virtualMr';

export const BOT_CATEGORIES: { id: BotCategory; label: string; color: string; bg: string }[] = [
  { id: 'security', label: 'Security', color: '#f59e0b', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  { id: 'performance', label: 'Performance', color: '#10b981', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  { id: 'architecture', label: 'Architecture', color: '#8b5cf6', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  { id: 'test', label: 'Bug Hunter', color: '#ef4444', bg: 'bg-red-500/10 text-red-400 border-red-500/20' },
  { id: 'style', label: 'Code Style', color: '#3b82f6', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  { id: 'documentation', label: 'Documentation', color: '#06b6d4', bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  { id: 'custom', label: 'Custom', color: '#ec4899', bg: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
];

export const DEFAULT_BOT_REVIEWERS: BotReviewer[] = [];
