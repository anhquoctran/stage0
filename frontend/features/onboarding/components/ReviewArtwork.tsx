import React from 'react';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';

export const ReviewArtwork: React.FC = () => (
  <div className="w-full border border-surface1 bg-base shadow-xl overflow-hidden rounded-sm">
    <div className="flex items-center justify-between border-b border-surface0 bg-mantle px-4 py-3 rounded-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-text">
        <GitPullRequest className="h-4 w-4 text-primary" />
        Virtual MR
      </div>
      <span className="border border-green/30 bg-green/10 px-2 py-1 text-[10px] text-green">Local draft</span>
    </div>
    <div className="space-y-4 p-4">
      <div>
        <p className="text-sm font-semibold text-text">Improve sign-in reliability</p>
        <p className="mt-2 text-xs leading-5 text-subtext0">Check session expiry before restoring a saved sign-in.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] text-primary">feature</span>
        <span className="border border-blue/30 bg-blue/10 px-2 py-1 text-[10px] text-blue">ready for review</span>
      </div>
      <div className="border border-surface0 bg-mantle p-3 rounded-sm">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-text">
          <CheckCircle2 className="h-3.5 w-3.5 text-green" />
          Review notes
        </div>
        <ol className="mt-3 space-y-3">
          {[
            { author: 'You', note: 'What happens when a saved session expires?', color: 'bg-blue' },
            { author: 'Reviewer', note: 'Keep the expiry check close to session validation.', color: 'bg-mauve' },
            { author: 'You', note: 'Add coverage for expired and missing sessions.', color: 'bg-green' },
          ].map((item) => <li key={item.note} className="flex items-start gap-2 rounded-sm">
            <span aria-hidden="true" className={`stage0-welcome-pulse mt-1 h-2 w-2 shrink-0 rounded-full ${item.color}`} />
            <div><p className="text-[10px] font-semibold text-subtext1">{item.author}</p><p className="mt-0.5 text-[11px] leading-5 text-subtext0">{item.note}</p></div>
          </li>)}
        </ol>
      </div>
    </div>
    <div className="flex items-center justify-between border-t border-surface0 px-4 py-3 text-[10px] text-subtext0 rounded-sm">
      <span>Saved on this device</span>
      <GitBranch className="h-3.5 w-3.5 text-subtext1" />
    </div>
  </div>
);
