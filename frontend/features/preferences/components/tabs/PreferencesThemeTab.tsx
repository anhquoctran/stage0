import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingRow } from '../SettingRow';
import { Monitor } from '../../../../common/components/icons/Monitor';
import { Sun } from '../../../../common/components/icons/Sun';
import { Moon } from '../../../../common/components/icons/Moon';
import type { ThemeMode } from '../../../../core/types/ThemeMode';
import { DEFAULT_THEMES, getTheme, themeDisplayName } from '../../../../core/themes/catalog';

export const PreferencesThemeTab: React.FC<{
  draftThemeMode: ThemeMode;
  setDraftThemeMode: (mode: ThemeMode) => void;
}> = ({ draftThemeMode, setDraftThemeMode }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <SettingRow title={t('preferences.theme.modeTitle')} description={t('preferences.theme.modeDescription')}>
        <div className="flex flex-wrap items-center gap-1.5 p-0.5 bg-surface0/60 rounded-sm border border-surface1/40">
          {([
            { id: 'system', label: t('preferences.theme.system'), icon: Monitor },
            { id: 'light', label: t('preferences.theme.light'), icon: Sun },
            { id: 'dark', label: t('preferences.theme.dark'), icon: Moon },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setDraftThemeMode(id)} aria-pressed={draftThemeMode === id}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-sm transition-colors cursor-pointer font-medium ${
                draftThemeMode === id ? 'bg-surface1 text-text border-0 shadow-xs' : 'text-subtext0 hover:text-text hover:bg-surface0/40'
              }`}>
              <Icon className="w-3.5 h-3.5" /><span>{label}</span>
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow title={t('preferences.theme.paletteTitle')} description={t('preferences.theme.paletteDescription')}>
        <div className="flex flex-wrap gap-3">
          {(['dark', 'light'] as const).map(kind => {
            const theme = getTheme(DEFAULT_THEMES[kind]);
            return <div key={kind} className="space-y-1">
              <p className="text-[10px] text-subtext0">{t(`preferences.theme.${kind}`)}</p>
              <button type="button" onClick={() => setDraftThemeMode(kind)} aria-pressed={draftThemeMode === kind}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-xs cursor-pointer transition-colors ${
                  draftThemeMode === kind ? 'border-brand bg-brand/10 text-text font-medium' : 'border-surface1/60 text-subtext0 bg-base hover:bg-mantle'
                }`}>
                <span className="w-3 h-3 rounded-full border border-surface1 shrink-0" style={{ backgroundColor: theme.colors.base }} />
                <span>{themeDisplayName(theme.id, key => t(key))}</span>
              </button>
            </div>;
          })}
        </div>
      </SettingRow>
    </div>
  );
};
