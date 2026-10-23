import React, { useState, useRef, useEffect } from 'react';
import { SettingRow } from '../SettingRow';
import { Undo2 } from '../../../../common/components/icons/Undo2';
import { ChevronDown } from '../../../../common/components/icons/ChevronDown';
import { Check } from '../../../../common/components/icons/Check';
import {
  DEFAULT_MARKDOWN_FONT_SETTINGS,
  MARKDOWN_PROSE_FONTS,
  MARKDOWN_CODE_FONTS,
} from '../../constants/markdownFonts';
import { applyMarkdownFontToDocument } from '../../utils/applyMarkdownFontToDocument';

export const PreferencesMarkdownFontTab: React.FC<{
  draftMarkdownFontFamily: string;
  setDraftMarkdownFontFamily: React.Dispatch<React.SetStateAction<string>>;
  draftMarkdownCodeFontFamily: string;
  setDraftMarkdownCodeFontFamily: React.Dispatch<React.SetStateAction<string>>;
  draftMarkdownFontSize: number;
  setDraftMarkdownFontSize: React.Dispatch<React.SetStateAction<number>>;
  draftMarkdownHeadingWeight: number;
  setDraftMarkdownHeadingWeight: React.Dispatch<React.SetStateAction<number>>;
  editorFontFamily?: string;
  editorFontSize?: number;
}> = ({
  draftMarkdownFontFamily,
  setDraftMarkdownFontFamily,
  draftMarkdownCodeFontFamily,
  setDraftMarkdownCodeFontFamily,
  draftMarkdownFontSize,
  setDraftMarkdownFontSize,
  draftMarkdownHeadingWeight,
  setDraftMarkdownHeadingWeight,
}) => {
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [isCodeDropdownOpen, setIsCodeDropdownOpen] = useState(false);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const codeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(e.target as Node)) {
        setIsFontDropdownOpen(false);
      }
      if (codeDropdownRef.current && !codeDropdownRef.current.contains(e.target as Node)) {
        setIsCodeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update live preview document styles as draft settings change
  useEffect(() => {
    applyMarkdownFontToDocument({
      fontFamily: draftMarkdownFontFamily,
      codeFontFamily: draftMarkdownCodeFontFamily,
      fontSize: draftMarkdownFontSize,
      headingFontWeight: draftMarkdownHeadingWeight,
    });
  }, [
    draftMarkdownFontFamily,
    draftMarkdownCodeFontFamily,
    draftMarkdownFontSize,
    draftMarkdownHeadingWeight,
  ]);

  return (
    <div className="space-y-4">
      <div className="text-xs font-mono font-semibold tracking-wider text-subtext0 select-none pb-1 border-b border-surface0/30">
        Markdown Preview Font
      </div>

      <div className="space-y-1">
        {/* 1. Font Family Row */}
        <SettingRow
          title={
            <div className="flex items-center gap-1.5">
              <span>Font Family</span>
              <button
                type="button"
                onClick={() => setDraftMarkdownFontFamily(DEFAULT_MARKDOWN_FONT_SETTINGS.fontFamily)}
                title="Reset font family to default (Arial)"
                className="text-subtext0 hover:text-text cursor-pointer transition-colors p-0.5 rounded-sm"
              >
                <Undo2 className="w-3 h-3" />
              </button>
            </div>
          }
          description="Font family for the markdown preview. Falls back to the UI font family."
        >
          <div className="relative w-56" ref={fontDropdownRef}>
            <button
              type="button"
              onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 border border-surface0 bg-crust hover:bg-base text-text text-xs transition-colors cursor-pointer rounded-sm"
            >
              <span className="truncate font-medium" style={{ fontFamily: draftMarkdownFontFamily }}>
                {draftMarkdownFontFamily}
              </span>
              <div className="flex flex-col text-subtext0 shrink-0 ml-2">
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isFontDropdownOpen ? 'rotate-180 text-text' : ''
                  }`}
                />
              </div>
            </button>

            {isFontDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-mantle border border-surface0 shadow-2xl z-50 overflow-hidden flex flex-col max-h-60 rounded-sm">
                <div className="overflow-y-auto p-1 divide-y divide-surface0/30">
                  {MARKDOWN_PROSE_FONTS.map((font) => {
                    const isSelected = font.toLowerCase() === draftMarkdownFontFamily.toLowerCase();
                    return (
                      <button
                        key={font}
                        type="button"
                        onClick={() => {
                          setDraftMarkdownFontFamily(font);
                          setIsFontDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer rounded-sm ${
                          isSelected
                            ? 'bg-surface0 text-text font-semibold'
                            : 'hover:bg-base text-subtext1 hover:text-text'
                        }`}
                      >
                        <span style={{ fontFamily: font }}>{font}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-text shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </SettingRow>

        {/* 2. Code Font Family Row */}
        <SettingRow
          title={
            <div className="flex items-center gap-1.5">
              <span>Code Font Family</span>
              <button
                type="button"
                onClick={() => setDraftMarkdownCodeFontFamily(DEFAULT_MARKDOWN_FONT_SETTINGS.codeFontFamily)}
                title="Reset code font family to default (Fira Code)"
                className="text-subtext0 hover:text-text cursor-pointer transition-colors p-0.5 rounded-sm"
              >
                <Undo2 className="w-3 h-3" />
              </button>
            </div>
          }
          description="Font family for code blocks in the markdown preview. Falls back to the editor font family."
        >
          <div className="relative w-56" ref={codeDropdownRef}>
            <button
              type="button"
              onClick={() => setIsCodeDropdownOpen(!isCodeDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-1.5 border border-surface0 bg-crust hover:bg-base text-text text-xs transition-colors cursor-pointer rounded-sm"
            >
              <span className="truncate font-mono" style={{ fontFamily: draftMarkdownCodeFontFamily }}>
                {draftMarkdownCodeFontFamily}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-subtext0 transition-transform duration-200 shrink-0 ml-2 ${
                  isCodeDropdownOpen ? 'rotate-180 text-text' : ''
                }`}
              />
            </button>

            {isCodeDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-mantle border border-surface0 shadow-2xl z-50 overflow-hidden flex flex-col max-h-60 rounded-sm">
                <div className="overflow-y-auto p-1 divide-y divide-surface0/30">
                  {MARKDOWN_CODE_FONTS.map((font) => {
                    const isSelected = font.toLowerCase() === draftMarkdownCodeFontFamily.toLowerCase();
                    return (
                      <button
                        key={font}
                        type="button"
                        onClick={() => {
                          setDraftMarkdownCodeFontFamily(font);
                          setIsCodeDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors cursor-pointer rounded-sm ${
                          isSelected
                            ? 'bg-surface0 text-text font-semibold'
                            : 'hover:bg-base text-subtext1 hover:text-text'
                        }`}
                      >
                        <span className="font-mono text-xs" style={{ fontFamily: font }}>
                          {font}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-text shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </SettingRow>

        {/* 3. Font Size Row */}
        <SettingRow
          title={
            <div className="flex items-center gap-1.5">
              <span>Font Size</span>
              <button
                type="button"
                onClick={() => setDraftMarkdownFontSize(DEFAULT_MARKDOWN_FONT_SETTINGS.fontSize)}
                title="Reset font size to default (14.00)"
                className="text-subtext0 hover:text-text cursor-pointer transition-colors p-0.5 rounded-sm"
              >
                <Undo2 className="w-3 h-3" />
              </button>
            </div>
          }
          description="Font size for the markdown preview. Falls back to the editor font size."
        >
          <div className="flex items-center border border-surface0 bg-crust rounded-sm overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setDraftMarkdownFontSize((prev) => Math.max(10, prev - 1))}
              className="px-2.5 py-1 hover:bg-surface0 text-subtext0 hover:text-text cursor-pointer font-bold transition-colors select-none"
              title="Decrease font size"
            >
              -
            </button>
            <span className="px-3 py-1 font-mono text-xs text-text text-center min-w-[58px] select-none">
              {draftMarkdownFontSize.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => setDraftMarkdownFontSize((prev) => Math.min(32, prev + 1))}
              className="px-2.5 py-1 hover:bg-surface0 text-subtext0 hover:text-text cursor-pointer font-bold transition-colors select-none"
              title="Increase font size"
            >
              +
            </button>
          </div>
        </SettingRow>

        {/* 4. Heading Font Weight Row */}
        <SettingRow
          title={
            <div className="flex items-center gap-1.5">
              <span>Heading Font Weight</span>
              <button
                type="button"
                onClick={() => setDraftMarkdownHeadingWeight(DEFAULT_MARKDOWN_FONT_SETTINGS.headingFontWeight)}
                title="Reset heading weight to default (600)"
                className="text-subtext0 hover:text-text cursor-pointer transition-colors p-0.5 rounded-sm"
              >
                <Undo2 className="w-3 h-3" />
              </button>
            </div>
          }
          description="Font weight for headings in the markdown preview, in CSS units from 100 to 900."
          borderBottom={false}
        >
          <div className="flex items-center border border-surface0 bg-crust rounded-sm overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setDraftMarkdownHeadingWeight((prev) => Math.max(100, prev - 100))}
              className="px-2.5 py-1 hover:bg-surface0 text-subtext0 hover:text-text cursor-pointer font-bold transition-colors select-none"
              title="Decrease heading weight"
            >
              -
            </button>
            <span className="px-3 py-1 font-mono text-xs text-text text-center min-w-[58px] select-none">
              {draftMarkdownHeadingWeight}
            </span>
            <button
              type="button"
              onClick={() => setDraftMarkdownHeadingWeight((prev) => Math.min(900, prev + 100))}
              className="px-2.5 py-1 hover:bg-surface0 text-subtext0 hover:text-text cursor-pointer font-bold transition-colors select-none"
              title="Increase heading weight"
            >
              +
            </button>
          </div>
        </SettingRow>
      </div>

      {/* Live Preview Sample */}
      <div className="mt-6 pt-4 border-t border-surface0/60">
        <div className="text-[11px] font-mono uppercase tracking-wider text-subtext0 mb-2">
          Live Preview
        </div>
        <div
          className="markdown-preview p-4 rounded-sm bg-crust border border-surface0 select-text"
          style={{
            fontFamily: draftMarkdownFontFamily,
            fontSize: `${draftMarkdownFontSize}px`,
          }}
        >
          <h2
            style={{
              fontWeight: draftMarkdownHeadingWeight,
              borderBottom: '1px solid var(--ctp-surface0)',
              paddingBottom: '0.2em',
              marginBottom: '0.4em',
            }}
          >
            Markdown Preview Header
          </h2>
          <p className="text-subtext1 mb-2">
            This is a preview paragraph rendered using <strong className="text-text">{draftMarkdownFontFamily}</strong> at <span className="font-mono text-xs">{draftMarkdownFontSize}px</span> font size.
          </p>
          <pre
            className="p-2.5 rounded-sm bg-surface0/40 border border-surface1/40 overflow-x-auto text-xs"
            style={{ fontFamily: draftMarkdownCodeFontFamily }}
          >
            <code>{`function previewCodeBlock() {\n  const font = "${draftMarkdownCodeFontFamily}";\n  return font;\n}`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

