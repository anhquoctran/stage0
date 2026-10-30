import React from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
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
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div className="space-y-3">
      <SettingRow
        title={translateUiText('preferences.diffOptions.visualizationTitle')}
        description={translateUiText('preferences.diffOptions.visualizationDescription')}
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
            {translateUiText('common.layout.viewSplit')}
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
            {translateUiText('common.layout.viewUnified')}
          </button>
        </div>
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.diffOptions.ignoreWhitespaceTitle')}
        description={translateUiText('preferences.diffOptions.ignoreWhitespaceDescription')}
      >
        <ZedSwitch
          checked={draftIgnoreWhitespace}
          onChange={setDraftIgnoreWhitespace}
        />
      </SettingRow>

      <SettingRow
        title={translateUiText('preferences.diffOptions.wordWrapTitle')}
        description={translateUiText('preferences.diffOptions.wordWrapDescription')}
      >
        <ZedSwitch
          checked={draftWordWrap}
          onChange={setDraftWordWrap}
        />
      </SettingRow>
    </div>
  );
};

