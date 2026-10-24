import React from 'react';
import { SettingRow } from '../SettingRow';
import { Monitor } from '../../../../common/components/icons/Monitor';
import { Sun } from '../../../../common/components/icons/Sun';
import { Moon } from '../../../../common/components/icons/Moon';
import { type ThemeMode } from '../../../../core/types/ThemeMode';

export const PreferencesThemeTab: React.FC<{
  draftThemeMode: ThemeMode;
  setDraftThemeMode: (mode: ThemeMode) => void;
  draftThemeId: string;
  setDraftThemeId: (id: string) => void;
}> = ({
  draftThemeMode,
  setDraftThemeMode,
  draftThemeId,
  setDraftThemeId,
}) => {
  return (
    <div className="space-y-4">
      <SettingRow
        title="Interface Theme Mode"
        description="Choose whether to follow your system color scheme or lock to light or dark mode."
      >
        <div className="flex items-center gap-1.5 p-0.5 bg-surface0/60 rounded border border-surface1/40">
          {(
            [
              { id: 'system', label: 'System', icon: Monitor },
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'dark', label: 'Dark', icon: Moon },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDraftThemeMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-all cursor-pointer font-medium ${
                draftThemeMode === id
                  ? 'bg-surface1 text-text shadow-xs'
                  : 'text-subtext0 hover:text-text hover:bg-surface0/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow
        title="Color Palette"
        description="Catppuccin flavour used when dark mode is active."
      >
        <div className="flex items-center gap-2">
          {[
            { id: 'catppuccin-mocha', label: 'Mocha', color: '#1e1e2e' },
            { id: 'catppuccin-latte', label: 'Latte', color: '#eff1f5' },
          ].map(({ id, label, color }) => (
            <button
              key={id}
              type="button"
              onClick={() => setDraftThemeId(id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs cursor-pointer transition-all ${
                draftThemeId === id
                  ? 'border-brand bg-brand/10 text-text font-medium'
                  : 'border-surface1/60 hover:border-surface2 text-subtext0 bg-surface0/30 hover:bg-surface0/60'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full border border-surface1 shrink-0"
                style={{ backgroundColor: color }}
              />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </SettingRow>
    </div>
  );
};
