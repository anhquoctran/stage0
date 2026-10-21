import React from 'react';
import { Plus } from '../../../../common/components/icons/Plus';
import { formatShortcutText } from '../../../../common/utils/shortcuts';

export const TabBarNewButton: React.FC<{
  onClick: () => void;
}> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-7 h-7 flex items-center justify-center bg-surface1 hover:bg-surface2 text-white transition-colors shrink-0 cursor-pointer shadow-xs"
      title={formatShortcutText('New Virtual MR (Ctrl+T)')}
    >
      <Plus className="w-4 h-4 text-white" />
    </button>
  );
};

