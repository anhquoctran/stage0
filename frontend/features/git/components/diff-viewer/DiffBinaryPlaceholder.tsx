import React from 'react';
import { FileWarning } from '../../../../common/components/icons/FileWarning';

export const DiffBinaryPlaceholder: React.FC = () => {
  return (
    <div className="flex min-h-64 h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center border border-amber-400/30 bg-amber-400/10 text-amber-400">
        <FileWarning className="h-6 w-6" />
      </div>
      <h3 className="mb-1 text-sm font-semibold text-text">Binary file — diff preview not supported</h3>
      <p className="max-w-md text-xs leading-relaxed text-subtext1">
        Git detected binary content in this file. Stage0 can track the file change, but cannot render a text diff for it.
      </p>
      <p className="mt-2 text-[11px] text-subtext0">
        Use the file actions above to reveal it and inspect it with an external application.
      </p>
    </div>
  );
};

