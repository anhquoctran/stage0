import React from 'react';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';

export const ReviewArtwork: React.FC = () => (
  <div className="w-full max-w-[25rem] border border-surface1 bg-base shadow-xl overflow-hidden">
    <div className="flex items-center justify-between border-b border-surface0 bg-mantle px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-text">
        <GitPullRequest className="h-4 w-4 text-primary" />
        Virtual MR
      </div>
      <span className="border border-green/30 bg-green/10 px-2 py-1 text-[10px] text-green">Local draft</span>
    </div>
    <div className="space-y-4 p-4">
      <div>
        <div className="mb-2 h-2 w-2/3 bg-subtext1/60" />
        <div className="h-1.5 w-full bg-surface0" />
        <div className="mt-1.5 h-1.5 w-4/5 bg-surface0" />
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] text-primary">feature</span>
        <span className="border border-blue/30 bg-blue/10 px-2 py-1 text-[10px] text-blue">ready for review</span>
      </div>
      <div className="border border-surface0 bg-mantle p-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-text">
          <CheckCircle2 className="h-3.5 w-3.5 text-green" />
          Review notes
        </div>
        <div className="mt-2 h-1.5 w-full bg-surface0" />
        <div className="mt-1.5 h-1.5 w-3/4 bg-surface0" />
      </div>
    </div>
    <div className="flex items-center justify-between border-t border-surface0 px-4 py-3 text-[10px] text-subtext0">
      <span>Saved on this device</span>
      <GitBranch className="h-3.5 w-3.5 text-subtext1" />
    </div>
  </div>
);
