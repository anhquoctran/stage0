import React from 'react';
import type { ReviewFinding } from '../types/ReviewFinding';

export const ReviewFindingCard: React.FC<{ finding: ReviewFinding }> = ({ finding }) => (
  <article className="border border-surface1 bg-base p-3 space-y-2">
    <h3 className="text-xs font-semibold text-text"><span className="uppercase text-primary">{finding.severity}</span> · {finding.title}</h3>
    <p className="font-mono text-[11px] text-subtext0 break-all">{finding.filePath} · {finding.side}:{finding.startLine}–{finding.endLine}</p>
    <p className="text-xs text-text whitespace-pre-wrap break-words select-text">{finding.body}</p>
    <pre className="max-h-36 overflow-auto border border-surface0 bg-mantle p-2 text-[11px] text-subtext1 select-text">{finding.evidence}</pre>
  </article>
);
