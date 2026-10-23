import React from 'react';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';

export const PreferencesResetModal: React.FC<{
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ isOpen, onCancel, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[var(--backdrop-modal)] backdrop-blur-xs animate-in fade-in duration-100">
      <div
        className="w-full max-w-md bg-mantle border border-surface0 shadow-2xl p-5 flex flex-col gap-3 text-text rounded-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 text-text">
          <AlertCircle className="w-5 h-5 text-subtext0 shrink-0" />
          <h3 className="text-sm font-bold">Reset All Preferences?</h3>
        </div>
        <p className="text-xs text-subtext0 leading-relaxed">
          This will restore all theme, font typography, inline blame, and AI configurations
          back to default values.
        </p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-subtext0 hover:text-text hover:bg-surface0/50 border border-surface0 transition-colors cursor-pointer rounded-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-1.5 text-xs bg-surface0 hover:bg-surface1 text-text border border-surface1 font-semibold transition-colors cursor-pointer rounded-sm"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

