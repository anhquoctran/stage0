import React from 'react';

export const DiffLoadingState: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-base text-subtext1">
      <div className="w-8 h-8 rounded-full border-2 border-blue border-t-transparent animate-spin mb-3" />
      <span className="text-sm font-medium text-text">Computing 3-dot MR diff...</span>
      <span className="text-xs text-subtext0 mt-1">Executing git diff and merge-tree simulation</span>
    </div>
  );
};

