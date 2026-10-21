import React from 'react';
import { Loader2 } from '../../../../common/components/icons/Loader2';
import { AlertTriangle } from '../../../../common/components/icons/AlertTriangle';
import { CheckCircle2 } from '../../../../common/components/icons/CheckCircle2';

export const TabBarSessionConflictIndicator: React.FC<{
  isLoading: boolean;
  hasConflict: boolean;
  conflictCount: number;
}> = ({ isLoading, hasConflict, conflictCount }) => {
  return (
    <div className="flex items-center shrink-0">
      {isLoading ? (
        <Loader2 className="w-3 h-3 text-subtext0 animate-spin" />
      ) : hasConflict ? (
        <span
          className="flex items-center gap-0.5 text-[10px] text-amber-400 font-mono"
          title={`${conflictCount} merge conflicts detected`}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>{conflictCount}</span>
        </span>
      ) : (
        <span title="Clean merge prediction">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
        </span>
      )}
    </div>
  );
};

