import React from 'react';
import { useReviewStore } from '../store/useReviewStore';

export const ReviewActivity: React.FC = () => {
  const run = useReviewStore((state) => state.detail?.run);
  const active = useReviewStore((state) => state.activeRuns);
  const finished = useReviewStore((state) => state.lastFinishedRun);
  const open = useReviewStore((state) => state.open);
  const running = Object.values(active);
  const target = running[0] || finished || run;
  if (!target) return null;
  return <button type="button" onClick={() => open(target.sessionId)} title="Open AI review run and history" className="px-2 text-[10px] text-primary hover:bg-surface0">AI review: {running.length ? `${running.length} running` : target.status}</button>;
};
