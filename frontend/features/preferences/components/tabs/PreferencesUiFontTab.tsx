import { useEffect } from 'react';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { BUNDLED_UI_FONT_FAMILIES, DEFAULT_UI_FONT_FAMILY } from '../../constants/uiFonts';
import { applyUiFontToDocument } from '../../utils/applyUiFontToDocument';
import type { PreferencesUiFontTabProps } from '../../types/PreferencesUiFontTabProps';
import { useSystemFontFamilies } from '../../hooks/useSystemFontFamilies';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';

export function PreferencesUiFontTab({ value, onChange }: PreferencesUiFontTabProps) {
  const { families, isLoading, error, refresh, native, canDiscover } = useSystemFontFamilies();
  const selectedAvailable = families.some((font) => font.toLowerCase() === value.toLowerCase());
  const options: CustomSelectOption<string>[] = families.map((font) => {
    const bundled = BUNDLED_UI_FONT_FAMILIES.some((family) => family.toLowerCase() === font.toLowerCase());
    return { value: font.toLowerCase() === value.toLowerCase() ? value : font, label: font,
      group: bundled ? 'Bundled fonts' : 'System fonts', badge: bundled ? 'Bundled' : 'Installed' };
  }).sort((left, right) => Number(right.badge === 'Bundled') - Number(left.badge === 'Bundled'));
  if (!selectedAvailable) options.unshift({ value, label: value, group: 'Saved preference',
    badge: isLoading ? 'Checking…' : 'Unavailable', disabled: true });
  useEffect(() => applyUiFontToDocument(value), [value]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="ui-font-family" className="text-xs font-semibold">UI Font Family</label>
        <CustomSelect id="ui-font-family" aria-label="UI Font Family" value={value} onChange={onChange}
          options={options}
          searchable buttonClassName="w-56" dropdownWidth="w-80" menuClassName="max-w-[calc(100vw-3rem)]" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm text-xs text-subtext0">
        <span role="status">{isLoading ? 'Reading installed fonts…' : `${families.length} available font families`}</span>
        {canDiscover && <button type="button" disabled={isLoading} onClick={() => { void refresh(true); }}
          className="rounded-sm border border-surface0 px-3 py-1.5 hover:bg-surface0 disabled:opacity-40">
          {native ? 'Refresh system fonts' : 'Load system fonts'}
        </button>}
      </div>
      {error && <p role="alert" className="text-xs text-red">{error}</p>}
      {!selectedAvailable && !isLoading && <p className="text-xs text-yellow">
        The saved font is not confirmed available on this device. The preview may use a fallback; choose an available font or reset to the bundled default.
      </p>}
      <p className="text-xs leading-relaxed text-subtext0">
        Used for menus, navigation, labels, and buttons. Buffer and Markdown fonts stay independent.
        Choices are read from installed system fonts and fonts bundled with Stage0.
        {!native && ' Browser access to system fonts requires permission; without it, only bundled fonts are listed.'}
      </p>
      <div className="rounded-sm border border-surface0 bg-crust p-4 text-text" style={{ fontFamily: value }}>
        <h3 className="text-[length:1rem] font-semibold text-text">Make Stage0 feel like home</h3>
        <p className="mt-2 text-sm text-subtext1">Repositories · Branches · Merge requests · Preferences</p>
        <p className="mt-2 text-xs text-subtext0">The quick brown fox jumps over the lazy dog. 0123456789</p>
      </div>
      <button type="button" onClick={() => onChange(DEFAULT_UI_FONT_FAMILY)}
        className="rounded-sm border border-surface0 px-3 py-1.5 text-xs text-subtext1 hover:bg-surface0">
        Reset UI font
      </button>
    </div>
  );
}
