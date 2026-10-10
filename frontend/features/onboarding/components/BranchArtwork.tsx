import React from 'react';
import { GitCompare } from '../../../common/components/icons/GitCompare';
import { ShieldCheck } from '../../../common/components/icons/ShieldCheck';

export const BranchArtwork: React.FC = () => (
  <div className="relative w-full max-w-[25rem] aspect-[1.35] border border-surface1 bg-base shadow-xl overflow-hidden">
    <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(var(--ctp-surface1) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 296" fill="none" aria-hidden="true">
      <path d="M75 75H135C162 75 158 128 194 128H327" stroke="var(--ctp-overlay1)" strokeWidth="3" />
      <path d="M75 220H135C162 220 158 167 194 167H327" stroke="var(--ctp-overlay1)" strokeWidth="3" />
      <path d="M194 128V167" stroke="var(--ctp-mauve)" strokeWidth="3" strokeDasharray="5 5" />
      <circle cx="75" cy="75" r="8" fill="var(--ctp-blue)" />
      <circle cx="75" cy="220" r="8" fill="var(--ctp-green)" />
      <circle cx="327" cy="128" r="8" fill="var(--ctp-mauve)" />
    </svg>
    <div className="absolute left-[10%] top-[18%] border border-surface1 bg-mantle px-3 py-2 text-[11px] font-mono text-text shadow-lg">
      <span className="mr-2 inline-block h-2 w-2 bg-blue" />main
    </div>
    <div className="absolute left-[10%] bottom-[16%] border border-surface1 bg-mantle px-3 py-2 text-[11px] font-mono text-text shadow-lg">
      <span className="mr-2 inline-block h-2 w-2 bg-green" />feature/login
    </div>
    <div className="absolute right-[7%] top-[35%] flex items-center gap-2 border border-primary/40 bg-mantle px-3 py-2 text-[11px] font-semibold text-text shadow-lg">
      <GitCompare className="h-3.5 w-3.5 text-primary" />
      Compare
    </div>
    <div className="absolute bottom-3 right-3 flex items-center gap-2 border border-surface1 bg-base/95 px-2.5 py-1.5 text-[10px] text-subtext1">
      <ShieldCheck className="h-3.5 w-3.5 text-green" />
      Working copy untouched
    </div>
  </div>
);
