import React, { useState, useRef, useMemo } from 'react';
import { SettingRow } from '../SettingRow';
import { ZedSwitch } from '../ZedSwitch';
import { Search } from '../../../../common/components/icons/Search';
import { Check } from '../../../../common/components/icons/Check';
import { ChevronDown } from '../../../../common/components/icons/ChevronDown';
import { Bold } from '../../../../common/components/icons/Bold';
import { Italic } from '../../../../common/components/icons/Italic';
import { Underline } from '../../../../common/components/icons/Underline';
import { SUPPORTED_FONTS } from '../../constants/fonts';
import { formatShortcutText } from '../../../../common/utils/shortcuts';
import { checkFontLigaturesSupport } from '../../store/usePreferencesStore';
import { useOutsideDismiss } from '../../../../common/hooks/useOutsideDismiss';

export const PreferencesFontTab: React.FC<{
  draftFontFamily: string;
  setDraftFontFamily: (val: string) => void;
  draftLineSpacing: number;
  setDraftLineSpacing: React.Dispatch<React.SetStateAction<number>>;
  draftEnableLigatures: boolean;
  setDraftEnableLigatures: (val: boolean) => void;
  simplified?: boolean;
  draftFontSize?: number;
  setDraftFontSize?: React.Dispatch<React.SetStateAction<number>>;
  draftIsBold?: boolean;
  setDraftIsBold?: (val: boolean) => void;
  draftIsItalic?: boolean;
  setDraftIsItalic?: (val: boolean) => void;
  draftIsUnderline?: boolean;
  setDraftIsUnderline?: (val: boolean) => void;
}> = ({
  draftFontFamily,
  setDraftFontFamily,
  draftLineSpacing,
  setDraftLineSpacing,
  draftEnableLigatures,
  setDraftEnableLigatures,
  simplified = false,
  draftFontSize = 13,
  setDraftFontSize,
  draftIsBold = false,
  setDraftIsBold,
  draftIsItalic = false,
  setDraftIsItalic,
  draftIsUnderline = false,
  setDraftIsUnderline,
}) => {
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const fontSearchInputRef = useRef<HTMLInputElement>(null);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const fontButtonRef = useRef<HTMLButtonElement>(null);
  useOutsideDismiss(fontDropdownRef, isFontDropdownOpen, () => setIsFontDropdownOpen(false));

  const filteredFonts = useMemo(() => {
    const q = fontSearchQuery.trim().toLowerCase();
    if (!q) return SUPPORTED_FONTS;
    return SUPPORTED_FONTS.filter((f) =>
      f.fontFamilyName.toLowerCase().includes(q)
    );
  }, [fontSearchQuery]);

  const selectedFontObj = useMemo(() => {
    return (
      SUPPORTED_FONTS.find(
        (f) => f.fontFamilyName.toLowerCase() === draftFontFamily.toLowerCase()
      ) || SUPPORTED_FONTS[0]
    );
  }, [draftFontFamily]);

  return (
    <div className="space-y-1">
      {/* Font Family Row */}
      <SettingRow
        title="Font Family"
        description="Monospace font family used across diff viewers, commit logs, and terminal panels."
      >
        <div
          ref={fontDropdownRef}
          className="relative w-64"
          onKeyDown={(event) => {
            if (isFontDropdownOpen && event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setIsFontDropdownOpen(false);
              fontButtonRef.current?.focus();
            }
          }}
        >
          <button
            ref={fontButtonRef}
            type="button"
            aria-label="Buffer Font Family"
            aria-expanded={isFontDropdownOpen}
            onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-1.5 border border-surface0 bg-crust hover:bg-base text-text text-xs transition-colors cursor-pointer rounded-sm"
          >
            <span
              className="truncate font-semibold"
              style={{ fontFamily: selectedFontObj.fontFamilyName }}
            >
              {selectedFontObj.fontFamilyName}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-subtext0 transition-transform duration-200 shrink-0 ms-2 ${
                isFontDropdownOpen ? 'rotate-180 text-text' : ''
              }`}
            />
          </button>

          {isFontDropdownOpen && (
            <div className="absolute end-0 top-full mt-1.5 w-72 bg-mantle border border-surface0 shadow-2xl z-50 overflow-hidden flex flex-col max-h-72 rounded-sm">
              <div className="p-2 border-b border-surface0 bg-crust sticky top-0 z-10 flex items-center gap-2 rounded-sm">
                <Search className="w-3 h-3 text-subtext0 shrink-0 ms-1" />
                <input
                  ref={fontSearchInputRef}
                  type="text"
                  placeholder="Filter monospace fonts..."
                  value={fontSearchQuery}
                  onChange={(e) => setFontSearchQuery(e.target.value)}
                  className="w-full bg-surface0 border border-surface1 px-2 py-1 text-xs text-text placeholder:text-subtext0 focus:outline-hidden rounded-sm"
                  autoFocus
                />
              </div>

              <div className="overflow-y-auto max-h-60 p-1 divide-y divide-surface0/30">
                {filteredFonts.length === 0 ? (
                  <div className="p-4 text-center text-xs text-subtext0 italic">
                    No fonts found
                  </div>
                ) : (
                  filteredFonts.map((font) => {
                    const isSelected =
                      font.fontFamilyName.toLowerCase() ===
                      draftFontFamily.toLowerCase();
                    return (
                      <button
                        key={font.fontFamilyName}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setDraftFontFamily(font.fontFamilyName);
                          setDraftEnableLigatures(font.ligaturesSupport);
                          setIsFontDropdownOpen(false);
                          fontButtonRef.current?.focus();
                        }}
                        onClick={() => {
                          setDraftFontFamily(font.fontFamilyName);
                          setDraftEnableLigatures(font.ligaturesSupport);
                          setIsFontDropdownOpen(false);
                          fontButtonRef.current?.focus();
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-start transition-colors cursor-pointer rounded-sm ${
                          isSelected
                            ? 'bg-surface0 text-text font-semibold'
                            : 'hover:bg-base text-subtext1 hover:text-text'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pe-2">
                          <span
                            className="text-xs truncate"
                            style={{ fontFamily: font.fontFamilyName }}
                          >
                            {font.fontFamilyName}
                          </span>
                          <span
                            className="text-[10px] text-subtext0 truncate opacity-70"
                            style={{ fontFamily: font.fontFamilyName }}
                          >
                            const code = (a != b) =&gt; a &amp;&amp; b;
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {font.ligaturesSupport ? (
                            <span className="text-[9px] px-1.5 py-0.5 bg-crust text-subtext0 border border-surface0 font-mono">
                              Ligatures
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 bg-crust text-subtext0/70 border border-surface0">
                              Mono
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5 text-text ms-1" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </SettingRow>

      {/* Font Size Row */}
      {!simplified && setDraftFontSize && (
        <SettingRow
          title="Font Size"
          description="Font size in pixels for diff lines and editor panes (range: 10px – 24px)."
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="10"
              max="24"
              value={draftFontSize}
              onChange={(e) =>
                setDraftFontSize(
                  Math.max(10, Math.min(24, parseInt(e.target.value) || 13))
                )
              }
              className="w-16 px-2.5 py-1.5 bg-crust border border-surface0 text-xs text-text focus:outline-hidden focus:border-surface1 font-mono text-center rounded-sm"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDraftFontSize((prev) => Math.max(10, prev - 1))}
                className="px-2 py-1 border border-surface0 hover:bg-surface0/50 text-text text-xs cursor-pointer font-bold rounded-sm"
                title="Decrease font size"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setDraftFontSize((prev) => Math.min(24, prev + 1))}
                className="px-2 py-1 border border-surface0 hover:bg-surface0/50 text-text text-xs cursor-pointer font-bold rounded-sm"
                title="Increase font size"
              >
                +
              </button>
            </div>
          </div>
        </SettingRow>
      )}

      {/* Font Styling Row */}
      {!simplified && setDraftIsBold && setDraftIsItalic && setDraftIsUnderline && (
        <SettingRow
          title="Font Weight & Emphasis"
          description="Apply Bold, Italic, or Underline formatting to diff text."
        >
          <div className="flex items-center gap-1 bg-crust p-0.5 border border-surface0 rounded-sm">
            <button
              type="button"
              onClick={() => setDraftIsBold(!draftIsBold)}
              className={`flex items-center gap-1 px-3 py-1 text-xs transition-colors cursor-pointer rounded-sm ${
                draftIsBold
                  ? 'bg-surface0 text-text font-bold shadow-xs'
                  : 'text-subtext0 hover:bg-surface0/40 hover:text-text'
              }`}
              title={formatShortcutText('Bold (Ctrl+B)')}
            >
              <Bold className="w-3 h-3" />
              <span>Bold</span>
            </button>

            <button
              type="button"
              onClick={() => setDraftIsItalic(!draftIsItalic)}
              className={`flex items-center gap-1 px-3 py-1 text-xs transition-colors cursor-pointer rounded-sm ${
                draftIsItalic
                  ? 'bg-surface0 text-text font-bold italic shadow-xs'
                  : 'text-subtext0 hover:bg-surface0/40 hover:text-text'
              }`}
              title={formatShortcutText('Italic (Ctrl+I)')}
            >
              <Italic className="w-3 h-3" />
              <span>Italic</span>
            </button>

            <button
              type="button"
              onClick={() => setDraftIsUnderline(!draftIsUnderline)}
              className={`flex items-center gap-1 px-3 py-1 text-xs transition-colors cursor-pointer rounded-sm ${
                draftIsUnderline
                  ? 'bg-surface0 text-text font-bold underline shadow-xs'
                  : 'text-subtext0 hover:bg-surface0/40 hover:text-text'
              }`}
              title={formatShortcutText('Underline (Ctrl+U)')}
            >
              <Underline className="w-3 h-3" />
              <span>Underline</span>
            </button>
          </div>
        </SettingRow>
      )}

      {/* Line Spacing Row */}
      <SettingRow
        title="Line Spacing"
        description="Vertical line height multiplier for comfortable code reading (1.1x – 2.2x)."
      >
        <div className="flex items-center gap-3 w-56">
          <input
            type="range"
            min="1.1"
            max="2.2"
            step="0.05"
            value={draftLineSpacing}
            onChange={(e) => setDraftLineSpacing(parseFloat(e.target.value))}
            className="w-full accent-brand cursor-pointer rounded-sm"
          />
          <span className="text-xs font-mono text-text shrink-0 w-10 text-end">
            {draftLineSpacing.toFixed(2)}x
          </span>
        </div>
      </SettingRow>

      {/* Ligatures Row */}
      <SettingRow
        title="Programming Ligatures"
        description="Render modern programming ligatures (e.g. !=, ===, =>) if supported by the active font."
      >
        <ZedSwitch
          checked={draftEnableLigatures}
          disabled={!checkFontLigaturesSupport(draftFontFamily)}
          onChange={setDraftEnableLigatures}
        />
      </SettingRow>

      {simplified && (
        <p className="pt-2 text-xs text-subtext0">
          Additional typography settings (font size, bold, italic, underline) can be customized anytime in Preferences.
        </p>
      )}
    </div>
  );
};
