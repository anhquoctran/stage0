import React from 'react';
import { ArrowLeftRight } from '../../../common/components/icons/ArrowLeftRight';
import { Code2 } from '../../../common/components/icons/Code2';
import { Sparkles } from '../../../common/components/icons/Sparkles';

export const CompareArtwork: React.FC = () => (
  <div className="w-full max-w-[25rem] border border-surface1 bg-base shadow-xl overflow-hidden">
    <div className="flex items-center justify-between border-b border-surface0 bg-mantle px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-text">
        <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
        Branch comparison
      </div>
      <span className="border border-yellow/30 bg-yellow/10 px-2 py-1 text-[10px] font-medium text-yellow">2 conflicts predicted</span>
    </div>
    <div className="space-y-2.5 p-4">
      {[
        { name: 'src/auth/session.ts', kind: 'Modified', additions: 3, deletions: 1 },
        { name: 'src/auth/provider.ts', kind: 'Conflict likely', additions: 2, deletions: 2 },
        { name: 'tests/session.test.ts', kind: 'Added', additions: 8, deletions: 0 },
      ].map((file) => (
        <div key={file.name} className="border border-surface0 bg-mantle px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-[11px] font-mono text-text">
              <Code2 className="h-3 w-3 shrink-0 text-subtext0" />
              <span className="truncate">{file.name}</span>
            </div>
            <span className={`shrink-0 text-[10px] ${file.kind === 'Conflict likely' ? 'text-yellow' : 'text-subtext0'}`}>{file.kind}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {Array.from({ length: file.additions }).map((_, index) => <span key={`a-${index}`} className="h-1.5 flex-1 bg-green/70" />)}
            {Array.from({ length: file.deletions }).map((_, index) => <span key={`d-${index}`} className="h-1.5 flex-1 bg-red/70" />)}
          </div>
        </div>
      ))}
    </div>
    <div className="flex items-center gap-2 border-t border-surface0 px-4 py-3 text-[11px] text-subtext1">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      Inspect each change before merging
    </div>
  </div>
);
