import React from 'react';
import { X } from '../../../common/components/icons/X';

export const PreferencesModalTopBar: React.FC<{
  onOpenJsonEditor: () => void;
  onClose: () => void;
}> = ({ onOpenJsonEditor, onClose }) => {
  return (
    <div className="h-10 ps-4 pe-0 bg-crust border-b border-surface0/80 flex items-center justify-between shrink-0 select-none">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold tracking-tight text-text">Preferences</span>
      </div>

      <div className="flex h-full items-center">
        <button
          type="button"
          onClick={onOpenJsonEditor}
          className="me-2 border border-surface0 px-2.5 py-1 text-[11px] text-subtext1 hover:bg-surface0 hover:text-text cursor-pointer rounded-sm"
          title="Edit the app preferences JSONC file"
        >
          Edit in preferences.json
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-full w-11 items-center justify-center text-subtext0 hover:text-text hover:bg-surface0/70 transition-colors cursor-pointer rounded-sm"
          title="Close (Esc)"
          aria-label="Close Preferences"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

