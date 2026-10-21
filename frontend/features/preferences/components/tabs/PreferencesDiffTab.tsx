import React from 'react';
import { SettingRow } from '../SettingRow';
import { ZedSwitch } from '../ZedSwitch';

export const PreferencesDiffTab: React.FC<{
  draftDiffViewMode: 'split' | 'unified';
  setDraftDiffViewMode: (mode: 'split' | 'unified') => void;
  draftIgnoreWhitespace: boolean;
  setDraftIgnoreWhitespace: (val: boolean) => void;
  draftWordWrap: boolean;
  setDraftWordWrap: (val: boolean) => void;
}> = ({
  draftDiffViewMode,
  setDraftDiffViewMode,
  draftIgnoreWhitespace,
  setDraftIgnoreWhitespace,
  draftWordWrap,
  setDraftWordWrap,
}) => {
  return (
    <div className="space-y-3">
      <SettingRow
        title="Diff Visualization Mode"
        description="Side-by-side split layout vs unified continuous inline diff view."
      >
        <div className="flex items-center gap-1.5 p-0.5 bg-surface0/60 rounded border border-surface1/40">
          <button
            type="button"
            onClick={() => setDraftDiffViewMode('split')}
            className={`px-3 py-1 text-xs rounded transition-all cursor-pointer font-medium ${
              draftDiffViewMode === 'split'
                ? 'bg-surface1 text-text shadow-xs'
                : 'text-subtext0 hover:text-text hover:bg-surface0/40'
            }`}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => setDraftDiffViewMode('unified')}
            className={`px-3 py-1 text-xs rounded transition-all cursor-pointer font-medium ${
              draftDiffViewMode === 'unified'
                ? 'bg-surface1 text-text shadow-xs'
                : 'text-subtext0 hover:text-text hover:bg-surface0/40'
            }`}
          >
            Unified
          </button>
        </div>
      </SettingRow>

      <SettingRow
        title="Ignore Whitespace Changes"
        description="Suppress whitespace-only modifications to focus on pure structural logic changes."
      >
        <ZedSwitch
          checked={draftIgnoreWhitespace}
          onChange={setDraftIgnoreWhitespace}
        />
      </SettingRow>

      <SettingRow
        title="Soft Word Wrap"
        description="Wrap overflowing code lines at the edge of the diff pane viewport."
      >
        <ZedSwitch
          checked={draftWordWrap}
          onChange={setDraftWordWrap}
        />
      </SettingRow>
    </div>
  );
};

