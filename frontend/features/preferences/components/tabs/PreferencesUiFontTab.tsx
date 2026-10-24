import { useEffect } from 'react';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { DEFAULT_UI_FONT_FAMILY, UI_FONT_FAMILIES } from '../../constants/uiFonts';
import { applyUiFontToDocument } from '../../utils/applyUiFontToDocument';
import type { PreferencesUiFontTabProps } from '../../types/PreferencesUiFontTabProps';

export function PreferencesUiFontTab({ value, onChange }: PreferencesUiFontTabProps) {
  useEffect(() => applyUiFontToDocument(value), [value]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="ui-font-family" className="text-xs font-semibold">UI Font Family</label>
        <CustomSelect id="ui-font-family" aria-label="UI Font Family" value={value} onChange={onChange}
          options={[...new Set([value, ...UI_FONT_FAMILIES])].map((font) => ({ value: font, label: font }))}
          searchable buttonClassName="w-56" />
      </div>
      <p className="text-xs leading-relaxed text-subtext0">
        Used for menus, navigation, labels, and buttons. Buffer and Markdown fonts stay independent.
        Fonts must be installed on your system; IBM Plex Sans is bundled with Stage0.
      </p>
      <div className="rounded-sm border border-surface0 bg-crust p-4" style={{ fontFamily: value }}>
        <h3 className="text-base font-semibold">Make Stage0 feel like home</h3>
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
