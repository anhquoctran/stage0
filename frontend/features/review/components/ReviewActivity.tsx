import React, { useEffect } from 'react';
import { useReviewStore } from '../store/useReviewStore';

export const ReviewActivity: React.FC = () => {
  const active = useReviewStore((state) => state.activeRuns);
  const finished = useReviewStore((state) => state.lastFinishedRun);
  const batches = useReviewStore((state) => state.reviewBatches);
  const syncActive = useReviewStore((state) => state.syncActive);
  const running = Object.values(active);
  const batch = Object.values(batches)[0];
  const activeIds = Object.keys(active).sort().join(',');
  const target = running[0] || finished;

  useEffect(() => {
    if (!activeIds) return;
    void syncActive();
    const timer = window.setInterval(() => void syncActive(), 1500);
    return () => window.clearInterval(timer);
  }, [activeIds, syncActive]);

  if (!target && !batch) return null;
  const label = batch
    ? `AI review: ${batch.phase === 'preparing-description' ? 'summarizing MR' : 'reviewing'} ${batch.current}/${batch.total}`
    : running.length
      ? `AI review: ${running.length} running`
      : `AI review: ${target!.status}${target!.findings.length ? ` · ${target!.findings.length} findings` : ''}`;

  return (
    <span
      role="status"
      title={batch ? `${batch.reviewerName} · ${label}` : target!.error || target!.summary || 'AI review status'}
      className="px-2 text-[10px] text-primary"
    >
      {label}
    </span>
  );
};
