import React from 'react';
import { CheckCircle2 } from '../../../../common/components/icons/CheckCircle2';

export const DiffNoChangesPlaceholder: React.FC<{
  status: string;
}> = ({ status }) => {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-subtext1 text-xs space-y-1">
      <CheckCircle2 className="w-8 h-8 text-green mb-2" />
      <p className="font-semibold text-text">No textual difference</p>
      <span className="text-[11px] text-subtext0">
        File status: {status} (empty or mode change)
      </span>
    </div>
  );
};

