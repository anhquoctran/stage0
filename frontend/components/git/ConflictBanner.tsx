import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileWarning, ShieldAlert } from 'lucide-react';
import { ConflictReport } from '../../types/git';

interface ConflictBannerProps {
  conflictReport: ConflictReport | null;
  onSelectConflictFile?: (filePath: string) => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({
  conflictReport,
  onSelectConflictFile,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!conflictReport || !conflictReport.has_conflicts) {
    return null;
  }

  const conflictedCount = conflictReport.conflicted_files.length;

  return (
    <div className="bg-gradient-to-r from-red/15 via-maroon/10 to-red/5 border-b border-red/30 px-4 py-2.5 text-text select-none shadow-md z-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-red/20 text-red rounded-lg border border-red/40 shadow-xs">
            <ShieldAlert className="w-4 h-4 text-red" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-red">
                Merge Conflicts Detected
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red/25 text-red font-mono font-bold border border-red/40 conflict-pulse">
                {conflictedCount > 0 ? `${conflictedCount} file(s)` : 'In-memory conflict'}
              </span>
            </div>
            <p className="text-[11px] text-subtext1 mt-0.5">
              Simulated in-memory via <code className="font-mono text-red bg-surface0 px-1 py-0.2 rounded border border-surface1">git merge-tree</code>. Your working copy remains 100% clean and untouched.
            </p>
          </div>
        </div>

        {conflictedCount > 0 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-red/20 hover:bg-red/30 border border-red/40 text-red transition-colors shadow-xs"
          >
            <span>{isExpanded ? 'Hide Conflicted Files' : 'Inspect Conflicts'}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-red" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-red" />
            )}
          </button>
        )}
      </div>

      {isExpanded && conflictedCount > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-red/20 animate-in fade-in duration-150">
          <div className="text-[11px] font-bold uppercase tracking-wider text-red mb-1.5">
            Click to view conflicting file:
          </div>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
            {conflictReport.conflicted_files.map((file) => (
              <button
                key={file}
                type="button"
                onClick={() => onSelectConflictFile?.(file)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-mantle border border-surface1 text-xs font-mono text-text hover:bg-surface0 hover:border-red transition-colors"
                title={`Open diff for ${file}`}
              >
                <FileWarning className="w-3.5 h-3.5 text-red shrink-0" />
                <span className="truncate max-w-[280px]">{file}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
