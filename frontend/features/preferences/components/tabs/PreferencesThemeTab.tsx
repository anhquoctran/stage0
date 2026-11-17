import React from 'react';
import { useTranslation } from 'react-i18next';
import { SettingRow } from '../SettingRow';
import { Monitor } from '../../../../common/components/icons/Monitor';
import { Sun } from '../../../../common/components/icons/Sun';
import { Moon } from '../../../../common/components/icons/Moon';
import type { ThemeMode } from '../../../../core/types/ThemeMode';
import { themeRegistry, themeDisplayName } from '../../../../core/themes/catalog';
import { CustomSelect } from '../../../../common/components/CustomSelect';

export const PreferencesThemeTab: React.FC<{
  draftThemeMode: ThemeMode;
  setDraftThemeMode: (mode: ThemeMode) => void;
  draftDarkThemeId: string;
  setDraftDarkThemeId: (id: string) => void;
  draftLightThemeId: string;
  setDraftLightThemeId: (id: string) => void;
}> = ({ draftThemeMode, setDraftThemeMode, draftDarkThemeId, setDraftDarkThemeId, draftLightThemeId, setDraftLightThemeId }) => {
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(['dark', 'light'] as const).map(kind => {
            const selectedId = kind === 'dark' ? draftDarkThemeId : draftLightThemeId;
            const setSelectedId = kind === 'dark' ? setDraftDarkThemeId : setDraftLightThemeId;
            const options = themeRegistry.list(kind).map(theme => ({
              value: theme.id,
              label: themeDisplayName(theme.id, key => t(key)),
              icon: <span aria-hidden="true" className="flex shrink-0 gap-1">
                {[theme.colors.base, theme.colors.brand ?? theme.colors.base, theme.colors.text ?? '#ffffff'].map((color, index) => (
                  <span key={index} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                ))}
              </span>,
            }));
            return <section key={kind} className="space-y-2" aria-label={`${t(`preferences.theme.${kind}`)} themes`}>
              <h3 className="text-xs font-semibold text-subtext0">{t(`preferences.theme.${kind}`)}</h3>
              <CustomSelect value={selectedId} onChange={setSelectedId} options={options}
                aria-label={`${t(`preferences.theme.${kind}`)} ${t('preferences.theme.paletteTitle')}`}
                className="w-full" buttonClassName="w-full min-h-10" dropdownPlacement="auto" portal />
            </section>;
          })}
        </div>
      </SettingRow>
    </div>
  );
};
