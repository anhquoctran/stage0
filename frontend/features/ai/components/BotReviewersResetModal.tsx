import React from 'react';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';

export const BotReviewersResetModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-mantle border border-surface0 w-full max-w-md shadow-2xl p-5 space-y-4">
        <div className="flex items-center gap-3 text-yellow">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <h4 className="text-sm font-bold text-text">Reset Default Bot Reviewers?</h4>
        </div>
        <p className="text-xs text-subtext0 leading-relaxed">
          This will reset the reviewer bots list to defaults and remove any custom configured bots.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-surface0 hover:bg-surface1 text-text text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 bg-yellow hover:brightness-95 text-on-accent font-semibold text-xs cursor-pointer shadow-xs"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

