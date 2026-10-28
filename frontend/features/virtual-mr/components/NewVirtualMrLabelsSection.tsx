import React from 'react';
import { Tag } from '../../../common/components/icons/Tag';
import { Plus } from '../../../common/components/icons/Plus';
import { X } from '../../../common/components/icons/X';
import { Check } from '../../../common/components/icons/Check';
import type { RepoLabel } from '../types/RepoLabel';

export const NewVirtualMrLabelsSection: React.FC<{
  selectedLabels: string[];
  repoLabels: RepoLabel[];
  isLoadingLabelOptions: boolean;
  showLabelDropdown: boolean;
  setShowLabelDropdown: (show: boolean) => void;
  onToggleLabelDropdown: () => void;
  onToggleLabel: (labelId: string) => void;
  onRemoveLabel: (labelId: string) => void;
  labelSearch: string;
  setLabelSearch: (search: string) => void;
  newLabelColor: string;
  setNewLabelColor: (color: string) => void;
  handleCreateAndSelectLabel: () => void;
  labelDropdownRef: React.RefObject<HTMLDivElement | null>;
}> = ({
  selectedLabels,
  repoLabels,
  isLoadingLabelOptions,
  showLabelDropdown,
  setShowLabelDropdown,
  onToggleLabelDropdown,
  onToggleLabel,
  onRemoveLabel,
  labelSearch,
  setLabelSearch,
  newLabelColor,
  setNewLabelColor,
  handleCreateAndSelectLabel,
  labelDropdownRef,
}) => {
  return (
    <div className="relative p-3 border border-surface1 bg-mantle/70 space-y-2 select-none rounded-sm" ref={labelDropdownRef}>
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-subtext1 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-teal" />
          <span>Labels</span>
        </div>
        <button
          type="button"
          onClick={onToggleLabelDropdown}
          className="p-1 text-subtext0 hover:text-teal hover:bg-surface0 transition-colors cursor-pointer rounded-sm"
          title="Edit Labels"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selected Labels Chips or Empty State */}
      {selectedLabels.length === 0 ? (
        <div className="text-xs text-subtext0/70 italic py-0.5">
          None yet
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {selectedLabels.map((lblId) => {
            const lbl = repoLabels.find((l) => l.id === lblId);
            if (!lbl) return null;
            return (
              <div
                key={lbl.id}
                className="flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-medium border rounded-sm"
                style={{
                  backgroundColor: `${lbl.color}20`,
                  borderColor: `${lbl.color}40`,
                  color: lbl.color,
                }}
              >
                <span className="truncate max-w-[120px]">{lbl.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveLabel(lbl.id)}
                  className="hover:opacity-100 opacity-60 transition-opacity cursor-pointer ms-0.5 rounded-sm"
                  title={`Remove ${lbl.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Label Dropdown Popover */}
      {showLabelDropdown && (
        <div className="absolute top-full end-0 mt-1 w-64 bg-mantle border border-surface0 shadow-2xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100 rounded-sm">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-subtext0 bg-base/60 border-b border-surface0/60 flex items-center justify-between rounded-sm">
            <span>Apply Labels</span>
            <button
              type="button"
              onClick={() => setShowLabelDropdown(false)}
              className="text-subtext0 hover:text-text cursor-pointer rounded-sm"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Filter / Create input */}
          <div className="p-2 bg-base/40 border-b border-surface0/60 space-y-1.5 rounded-sm">
            <div className="relative">
              <input
                type="text"
                placeholder="Filter or type to add..."
                value={labelSearch}
                onChange={(e) => setLabelSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateAndSelectLabel();
                  }
                }}
                className="w-full px-2.5 py-1 bg-mantle border border-surface0 text-xs text-text placeholder-subtext0 focus:outline-none focus:border-brand font-mono rounded-sm"
                autoFocus
              />
            </div>

            {/* Color picker presets if typing a new label */}
            {labelSearch.trim() && !repoLabels.some((l) => l.name.toLowerCase() === labelSearch.trim().toLowerCase()) && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-subtext0">Color:</span>
                <div className="flex items-center gap-1">
                  {['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewLabelColor(color)}
                      className={`w-3.5 h-3.5 border transition-transform cursor-pointer rounded-sm ${
                        newLabelColor === color ? 'scale-125 border-white' : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Label Items List */}
          <div className="max-h-48 overflow-y-auto divide-y divide-surface0/40">
            {isLoadingLabelOptions ? (
              <div className="px-3 py-3 text-center text-xs text-subtext0/70">
                Loading labels...
              </div>
            ) : (
              <>
                {/* Create new label action button if search input doesn't match existing */}
                {labelSearch.trim() && !repoLabels.some((l) => l.name.toLowerCase() === labelSearch.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={handleCreateAndSelectLabel}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-surface0 text-start text-xs text-brand transition-colors cursor-pointer font-medium rounded-sm"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Create label <strong>"{labelSearch.trim()}"</strong></span>
                  </button>
                )}

                {/* Existing labels */}
                {repoLabels
                  .filter((lbl) => lbl.name.toLowerCase().includes(labelSearch.toLowerCase()))
                  .map((lbl) => {
                    const isSelected = selectedLabels.includes(lbl.id);
                    return (
                      <button
                        key={lbl.id}
                        type="button"
                        onClick={() => onToggleLabel(lbl.id)}
                        className={`w-full px-3 py-2 flex items-center justify-between text-start transition-colors cursor-pointer rounded-sm ${
                          isSelected ? 'bg-surface0 font-medium' : 'hover:bg-surface0/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pe-2">
                          <span
                            className="w-2.5 h-2.5 shrink-0"
                            style={{ backgroundColor: lbl.color }}
                          />
                          <span className="text-xs text-text truncate">{lbl.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                      </button>
                    );
                  })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

