import React from 'react';
import { RotateCcw } from '../../../common/components/icons/RotateCcw';
import { Check } from '../../../common/components/icons/Check';

export const PreferencesModalFooter: React.FC<{
  applyError: string | null;
  totalUnsaved: number;
  hasUnsavedChanges: boolean;
  canCommitPreferences: boolean;
  isApplying: boolean;
  isApplied: boolean;
  onResetDefaultsPrompt: () => void;
  onCancel: () => void;
  onApply: () => void;
  onOk: () => void;
}> = ({
  applyError,
  totalUnsaved,
  hasUnsavedChanges,
  canCommitPreferences,
  isApplying,
  isApplied,
  onResetDefaultsPrompt,
  onCancel,
  onApply,
  onOk,
}) => {
  return (
    <>
      {applyError && (
        <p role="alert" className="px-6 py-2 text-xs text-red break-words">
          {applyError}
        </p>
      )}
      <div className="px-6 py-3 border-t border-surface0/60 flex items-center justify-between bg-crust/80 select-none shrink-0 rounded-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onResetDefaultsPrompt}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-surface0 hover:bg-surface0/50 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer rounded-sm"
            title="Reset all settings to application defaults"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to default</span>
          </button>

          {totalUnsaved > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-subtext0 font-medium">
              <span className="w-1.5 h-1.5 bg-subtext0" />
              <span>{totalUnsaved} unsaved</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 border border-surface0 hover:bg-surface0/50 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer font-medium rounded-sm"
            title="Close without saving (Esc)"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onApply}
            disabled={isApplying || !hasUnsavedChanges}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold transition-all rounded-sm ${
              isApplied
                ? 'bg-green/10 border-green/30 text-green'
                : canCommitPreferences
                  ? 'bg-purple-600 hover:bg-purple-500 text-text shadow-xs cursor-pointer'
                  : 'bg-transparent text-subtext0 opacity-40 cursor-not-allowed'
            }`}
          >
            {isApplied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Applied</span>
              </>
            ) : (
              <span>{isApplying ? 'Applying…' : 'Apply'}</span>
            )}
          </button>

          <button
            type="button"
            onClick={onOk}
            disabled={isApplying}
            className={`px-4 py-1.5 text-xs font-semibold transition-colors rounded-sm ${
              !isApplying
                ? 'bg-surface0 hover:bg-surface1 text-text cursor-pointer shadow-xs'
                : 'bg-transparent text-subtext0 opacity-40 cursor-not-allowed'
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </>
  );
};

