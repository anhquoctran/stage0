import { useEffect } from 'react';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import {
  BUNDLED_UI_FONT_FAMILIES,
  DEFAULT_UI_FONT_FAMILY,
  RECOMMENDED_UI_FONT_FAMILIES,
} from '../../constants/uiFonts';
import { applyUiFontToDocument } from '../../utils/applyUiFontToDocument';
import type { PreferencesUiFontTabProps } from '../../types/PreferencesUiFontTabProps';
import { useSystemFontFamilies } from '../../hooks/useSystemFontFamilies';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import { useTranslation } from 'react-i18next';

export function PreferencesUiFontTab({ value, onChange, dropdownPlacement = 'bottom', dropdownListMaxHeight }: PreferencesUiFontTabProps) {
  const { t } = useTranslation();
  const { families, isLoading, error, refresh, native, canDiscover } = useSystemFontFamilies();
  const selectedAvailable = families.some((font) => font.toLowerCase() === value.toLowerCase());
  const options: CustomSelectOption<string>[] = families.map((font) => {
    const bundled = BUNDLED_UI_FONT_FAMILIES.some((family) => family.toLowerCase() === font.toLowerCase());
    const recommended = RECOMMENDED_UI_FONT_FAMILIES.some((family) => family.toLowerCase() === font.toLowerCase());
    return { value: font.toLowerCase() === value.toLowerCase() ? value : font, label: font,
      group: recommended ? t('preferences.uiFont.recommendedGroup') : t('preferences.uiFont.otherGroup'),
      badge: bundled ? t('preferences.uiFont.bundledBadge') : t('preferences.uiFont.installedBadge') };
  });
  if (!selectedAvailable) options.unshift({ value, label: value, group: t('preferences.uiFont.savedGroup'),
    badge: isLoading ? t('preferences.uiFont.checkingBadge') : t('preferences.uiFont.unavailableBadge'), disabled: true });
  useEffect(() => applyUiFontToDocument(value), [value]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="ui-font-family" className="text-xs font-semibold">{t('preferences.uiFont.title')}</label>
        <CustomSelect id="ui-font-family" aria-label={t('preferences.uiFont.title')} value={value} onChange={onChange}
          options={options}
          searchable buttonClassName="w-72" dropdownWidth="w-72" dropdownPlacement={dropdownPlacement}
          dropdownListMaxHeight={dropdownListMaxHeight}
          menuClassName="max-w-[calc(100vw-3rem)]" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm text-xs text-subtext0">
        <span role="status">{isLoading ? t('preferences.uiFont.readingFonts') : t('preferences.uiFont.availableFonts', { count: families.length })}</span>
        {canDiscover && <button type="button" disabled={isLoading} onClick={() => { void refresh(true); }}
          className="rounded-sm border border-surface0 px-3 py-1.5 hover:bg-surface0 disabled:opacity-40">
          {native ? t('preferences.uiFont.refreshSystemFonts') : t('preferences.uiFont.loadSystemFonts')}
        </button>}
      </div>
      {error && <p role="alert" className="text-xs text-red">{error}</p>}
      {!selectedAvailable && !isLoading && <p className="text-xs text-yellow">
        {t('preferences.uiFont.savedFontUnavailable')}
      </p>}
      <p className="text-xs leading-relaxed text-subtext0">
        {t('preferences.uiFont.description')}
        {!native && ` ${t('preferences.uiFont.browserPermissionFallback')}`}
      </p>
      <div className="rounded-sm border border-surface0 bg-crust p-4 text-text" style={{ fontFamily: value }}>
        <h3 className="text-[length:1rem] font-semibold text-text">{t('preferences.uiFont.previewTitle')}</h3>
        <p className="mt-2 text-sm text-subtext1">{t('preferences.uiFont.previewNavigation')}</p>
        <p className="mt-2 text-xs text-subtext0">{t('preferences.uiFont.sampleText')}</p>
      </div>
      <button type="button" onClick={() => onChange(DEFAULT_UI_FONT_FAMILY)}
        className="rounded-sm border border-surface0 px-3 py-1.5 text-xs text-subtext1 hover:bg-surface0">
        {t('preferences.uiFont.reset')}
      </button>
    </div>
  );
}
