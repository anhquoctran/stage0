import React from 'react';
import { Plus } from '../../../../common/components/icons/Plus';
import { X } from '../../../../common/components/icons/X';

export const GuardrailsFilesSection: React.FC<{
  sensitivePatterns: string[];
  newSensitivePattern: string;
  setNewSensitivePattern: (v: string) => void;
  onAddSensitivePattern: () => void;
  onRemoveSensitivePattern: (pat: string) => void;
  maxFileReadLines: number;
  onUpdateMaxFileReadLines: (lines: number) => void;
  requireConfirmationCommands: boolean;
  onToggleConfirmationCommands: (val: boolean) => void;
  requireConfirmationWrites: boolean;
  onToggleConfirmationWrites: (val: boolean) => void;
}> = ({
  sensitivePatterns,
  newSensitivePattern,
  setNewSensitivePattern,
  onAddSensitivePattern,
  onRemoveSensitivePattern,
  maxFileReadLines,
  onUpdateMaxFileReadLines,
  requireConfirmationCommands,
  onToggleConfirmationCommands,
  requireConfirmationWrites,
  onToggleConfirmationWrites,
}) => {
  return (
    <div className="p-4 bg-surface0/60 border border-surface1 space-y-4 rounded-sm">
      <h4 className="text-xs font-bold text-text">
        Workspace & Sensitive File Shield
      </h4>

      <div className="space-y-2">
        <label className="text-[11px] font-medium text-subtext0">
          Protected Sensitive File Patterns (Access Blocked)
        </label>
        <div className="flex flex-wrap gap-1.5 p-2.5 bg-base border border-surface1 min-h-[42px] items-center rounded-sm">
          {sensitivePatterns.map((pat) => (
            <span
              key={pat}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-mauve/10 text-mauve border border-mauve/30 font-mono font-medium"
            >
              <span>{pat}</span>
              <button
                type="button"
                onClick={() => onRemoveSensitivePattern(pat)}
                className="opacity-70 hover:opacity-100 cursor-pointer rounded-sm"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="e.g. *.key, secrets.yaml"
            value={newSensitivePattern}
            onChange={(e) => setNewSensitivePattern(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddSensitivePattern())}
            className="flex-1 px-2.5 py-1 text-xs bg-base border border-surface1 text-text font-mono focus:outline-none focus:border-surface2 rounded-sm"
          />
          <button
            type="button"
            onClick={onAddSensitivePattern}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-surface1 border border-surface2 text-text hover:bg-surface2 cursor-pointer transition rounded-sm"
          >
            <Plus className="w-3 h-3" />
            <span>Add Sensitive Pattern</span>
          </button>
        </div>
      </div>

      <div className="pt-2 border-t border-surface1 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-sm">
        <div className="flex-1">
          <label className="text-[11px] font-medium text-subtext0 block">
            Max File Read Line Range: <span className="text-text font-mono font-bold">{maxFileReadLines} lines</span>
          </label>
          <input
            type="range"
            min={500}
            max={5000}
            step={250}
            value={maxFileReadLines}
            onChange={(e) => onUpdateMaxFileReadLines(Number(e.target.value))}
            className="w-full mt-2 cursor-pointer rounded-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="confirm-commands-chk"
            checked={requireConfirmationCommands}
            onChange={(e) => onToggleConfirmationCommands(e.target.checked)}
            className="border-surface2 text-green focus:ring-0 cursor-pointer"
          />
          <label htmlFor="confirm-commands-chk" className="text-xs text-text cursor-pointer select-none">
            Require confirmation for all terminal commands
          </label>
        </div>
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="confirm-writes-chk"
            checked={requireConfirmationWrites}
            onChange={(e) => onToggleConfirmationWrites(e.target.checked)}
            className="mt-0.5 border-surface2 text-green focus:ring-0 cursor-pointer"
          />
          <div>
            <label htmlFor="confirm-writes-chk" className="text-xs text-text cursor-pointer select-none">
              Require confirmation for terminal tools that may write files
            </label>
            <p className="mt-1 text-[10px] text-subtext0">
              No approval dialog is available yet, so commands requiring confirmation are blocked rather than paused.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

