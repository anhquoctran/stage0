import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Type,
  Bold,
  Italic,
  Underline,
  Sparkles,
  RotateCcw,
  Check,
  Sliders,
  AlertCircle,
  ChevronDown,
  Search,
  Monitor,
  Moon,
  Sun,
  Palette,
  Key,
  Bot,
} from 'lucide-react';
import { SUPPORTED_FONTS } from '../../constants/fonts';
import {
  usePreferencesStore,
  checkFontLigaturesSupport,
} from '../../store/usePreferencesStore';
import { useThemeStore } from '../../store/useThemeStore';
import { GitCredentialsTab } from './GitCredentialsTab';
import { AiMcpTab } from './AiMcpTab';

type PreferenceTab = 'appearance' | 'fonts' | 'credentials' | 'ai';

export const PreferencesModal: React.FC = () => {
  const {
    isPreferencesOpen,
    setIsPreferencesOpen,
    fontFamily,
    fontSize,
    isBold,
    isItalic,
    isUnderline,
    lineSpacing,
    enableLigatures,
    updateViewerFontSettings,
    resetViewerFontSettings,
  } = usePreferencesStore();

  const { themeMode, setThemeMode } = useThemeStore();

  const [activeTab, setActiveTab] = useState<PreferenceTab>('appearance');

  // Custom Font Dropdown State
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const fontSearchInputRef = useRef<HTMLInputElement>(null);

  // Close font dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        fontDropdownRef.current &&
        !fontDropdownRef.current.contains(e.target as Node)
      ) {
        setIsFontDropdownOpen(false);
      }
    };

    if (isFontDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFontDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isFontDropdownOpen) {
      setTimeout(() => {
        fontSearchInputRef.current?.focus();
      }, 50);
    } else {
      setFontSearchQuery('');
    }
  }, [isFontDropdownOpen]);

  // Filter fonts by search query
  const filteredFonts = useMemo(() => {
    if (!fontSearchQuery.trim()) return SUPPORTED_FONTS;
    return SUPPORTED_FONTS.filter((f) =>
      f.fontFamilyName.toLowerCase().includes(fontSearchQuery.toLowerCase().trim())
    );
  }, [fontSearchQuery]);

  if (!isPreferencesOpen) return null;

  const currentFontSupportsLigatures = checkFontLigaturesSupport(fontFamily);
  const selectedFontObj = SUPPORTED_FONTS.find(
    (f) => f.fontFamilyName.toLowerCase() === fontFamily.toLowerCase()
  ) || { fontFamilyName: fontFamily, ligaturesSupport: currentFontSupportsLigatures };

  const tabs: { id: PreferenceTab; label: string; sublabel: string; icon: React.ReactNode }[] = [
    {
      id: 'appearance',
      label: 'Appearance',
      sublabel: 'Theme & Colors',
      icon: <Palette className="w-4 h-4" />,
    },
    {
      id: 'fonts',
      label: 'Viewer Fonts',
      sublabel: 'Diff & Raw Typography',
      icon: <Type className="w-4 h-4" />,
    },
    {
      id: 'credentials',
      label: 'Git Credentials',
      sublabel: 'OS Keyring & Tokens',
      icon: <Key className="w-4 h-4" />,
    },
    {
      id: 'ai',
      label: 'AI & MCP',
      sublabel: 'Models, Agents & Tools',
      icon: <Bot className="w-4 h-4" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-crust/75 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-mantle border border-surface0 max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col h-[640px] max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-surface0 flex items-center justify-between bg-base/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-surface0 border border-surface1 flex items-center justify-center text-text shadow-xs">
              <Sliders className="w-4 h-4 text-subtext0" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text">Preferences</h2>
              <p className="text-[11px] text-subtext0">
                Configure Appearance, Viewer Typography, and Secure Git Credentials
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPreferencesOpen(false)}
            className="p-1.5 rounded-lg hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Vertical Tabbed Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Vertical Sidebar Tabs (Left) */}
          <div className="w-56 bg-base/40 border-r border-surface0 p-3 flex flex-col gap-1 shrink-0 select-none">
            <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext0/70">
              Settings
            </div>

            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-start gap-2.5 px-3 py-2.5 text-left transition-all cursor-pointer border ${isActive
                      ? 'bg-surface1 border-surface2 text-text shadow-xs font-semibold ring-1 ring-surface2/50'
                      : 'border-transparent text-subtext0 hover:bg-surface0/60 hover:text-text'
                    }`}
                >
                  <div
                    className={`mt-0.5 shrink-0 ${isActive ? 'text-text' : 'text-subtext0'
                      }`}
                  >
                    {tab.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold leading-tight truncate">
                      {tab.label}
                    </div>
                    <div className="text-[10px] text-subtext0/80 leading-normal truncate mt-0.5">
                      {tab.sublabel}
                    </div>
                  </div>
                </button>
              );
            })}

            {/* <div className="mt-auto p-2.5 bg-surface0/30 border border-surface0/60 flex items-center gap-2 text-[10px] text-subtext0">
              <ShieldCheck className="w-3.5 h-3.5 text-green shrink-0" />
              <div className="min-w-0">
                <div className="text-text font-medium truncate">{keyringName}</div>
                <div className="text-[9px] text-subtext0 truncate">Tokenized Hardware Vault</div>
              </div>
            </div> */}
          </div>

          {/* Tab Content Panel (Right) */}
          <div className="flex-1 overflow-y-auto p-6 bg-mantle">
            {/* TAB 1: APPEARANCE & THEME */}
            {activeTab === 'appearance' && (
              <div className="space-y-5 animate-in fade-in duration-100">
                <div className="pb-3 border-b border-surface0">
                  <h3 className="text-sm font-bold text-text flex items-center gap-2">
                    <Palette className="w-4 h-4 text-subtext0" />
                    Color Theme
                  </h3>
                  <p className="text-[11px] text-subtext0 mt-0.5">
                    Select your preferred interface theme mode
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* System Option */}
                  <button
                    type="button"
                    onClick={() => setThemeMode('system')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer text-center relative group ${themeMode === 'system'
                        ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2'
                        : 'bg-surface0/50 border-surface0 text-subtext1 hover:bg-surface0 hover:text-text'
                      }`}
                  >
                    {themeMode === 'system' && (
                      <span className="absolute top-2.5 right-2.5">
                        <Check className="w-3.5 h-3.5 text-text" />
                      </span>
                    )}
                    <div
                      className={`p-2.5 mb-2 transition-colors ${themeMode === 'system'
                          ? 'bg-surface2 text-text'
                          : 'bg-surface0 text-subtext0 group-hover:text-text'
                        }`}
                    >
                      <Monitor className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-text">System</span>
                    <span className="text-[10px] text-subtext0 mt-0.5">
                      Sync with Operating System theme
                    </span>
                  </button>

                  {/* Dark Option */}
                  <button
                    type="button"
                    onClick={() => setThemeMode('dark')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer text-center relative group ${themeMode === 'dark'
                        ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2'
                        : 'bg-surface0/50 border-surface0 text-subtext1 hover:bg-surface0 hover:text-text'
                      }`}
                  >
                    {themeMode === 'dark' && (
                      <span className="absolute top-2.5 right-2.5">
                        <Check className="w-3.5 h-3.5 text-text" />
                      </span>
                    )}
                    <div
                      className={`p-2.5 mb-2 transition-colors ${themeMode === 'dark'
                          ? 'bg-surface2 text-text'
                          : 'bg-surface0 text-subtext0 group-hover:text-text'
                        }`}
                    >
                      <Moon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-text">Dark</span>
                    <span className="text-[10px] text-subtext0 mt-0.5">
                      Catppuccin Mocha aesthetic
                    </span>
                  </button>

                  {/* Light Option */}
                  <button
                    type="button"
                    onClick={() => setThemeMode('light')}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer text-center relative group ${themeMode === 'light'
                        ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2'
                        : 'bg-surface0/50 border-surface0 text-subtext1 hover:bg-surface0 hover:text-text'
                      }`}
                  >
                    {themeMode === 'light' && (
                      <span className="absolute top-2.5 right-2.5">
                        <Check className="w-3.5 h-3.5 text-text" />
                      </span>
                    )}
                    <div
                      className={`p-2.5 mb-2 transition-colors ${themeMode === 'light'
                          ? 'bg-surface2 text-text'
                          : 'bg-surface0 text-subtext0 group-hover:text-text'
                        }`}
                    >
                      <Sun className="w-5 h-5" />
                    </div>

                    <span className="text-xs font-semibold text-text">Light</span>
                    <span className="text-[10px] text-subtext0 mt-0.5">
                      Catppuccin Latte clean theme
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: VIEWER FONTS & TYPOGRAPHY */}
            {activeTab === 'fonts' && (
              <div className="space-y-4 animate-in fade-in duration-100">
                <div className="pb-3 border-b border-surface0">
                  <h3 className="text-sm font-bold text-text flex items-center gap-2">
                    <Type className="w-4 h-4 text-subtext0" />
                    Viewer Fonts &amp; Typography
                  </h3>
                  <p className="text-[11px] text-subtext0 mt-0.5">
                    Customize code font family, styles, line spacing, and ligatures for Diff &amp; Raw viewers
                  </p>
                </div>

                {/* Custom Font Family Dropdown */}
                <div className="relative" ref={fontDropdownRef}>
                  <label
                    htmlFor="preferences-font-family-trigger"
                    className="block text-xs font-medium text-text mb-1.5"
                  >
                    Font Family
                  </label>

                  {/* Dropdown Trigger Button */}
                  <button
                    id="preferences-font-family-trigger"
                    type="button"
                    onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${isFontDropdownOpen
                        ? 'bg-surface1 border-surface2 text-text ring-1 ring-surface2'
                        : 'bg-surface0/60 border-surface0 hover:bg-surface0 text-text'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="text-sm font-semibold truncate"
                        style={{ fontFamily: selectedFontObj.fontFamilyName }}
                      >
                        {selectedFontObj.fontFamilyName}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 bg-surface1 text-subtext0 border border-surface2 font-mono">
                        {selectedFontObj.ligaturesSupport
                          ? 'Ligatures supported'
                          : 'Standard monospace'}
                      </span>
                    </div>

                    <ChevronDown
                      className={`w-4 h-4 text-subtext0 transition-transform duration-200 shrink-0 ${isFontDropdownOpen ? 'rotate-180 text-text' : ''
                        }`}
                    />
                  </button>

                  {/* Custom Dropdown Menu Popover */}
                  {isFontDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-mantle border border-surface0 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-72">
                      {/* Search Input Filter */}
                      <div className="p-2 border-b border-surface0 bg-base/60 sticky top-0 z-10 flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-subtext0 shrink-0 ml-1.5" />
                        <input
                          ref={fontSearchInputRef}
                          type="text"
                          placeholder="Filter fonts..."
                          value={fontSearchQuery}
                          onChange={(e) => setFontSearchQuery(e.target.value)}
                          className="w-full bg-transparent text-xs text-text placeholder:text-subtext0 focus:outline-none py-1"
                        />
                        {fontSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setFontSearchQuery('')}
                            className="p-1 text-subtext0 hover:text-text rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Font Items List */}
                      <div className="overflow-y-auto divide-y divide-surface0/40 p-1">
                        {filteredFonts.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-subtext0 italic">
                            No matching font found
                          </div>
                        ) : (
                          filteredFonts.map((font) => {
                            const isSelected =
                              fontFamily.toLowerCase() === font.fontFamilyName.toLowerCase();

                            return (
                              <div
                                key={font.fontFamilyName}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  updateViewerFontSettings({
                                    fontFamily: font.fontFamilyName,
                                    enableLigatures: font.ligaturesSupport,
                                  });
                                  setIsFontDropdownOpen(false);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    updateViewerFontSettings({
                                      fontFamily: font.fontFamilyName,
                                      enableLigatures: font.ligaturesSupport,
                                    });
                                    setIsFontDropdownOpen(false);
                                  }
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer group ${isSelected
                                    ? 'bg-surface1 text-text font-semibold'
                                    : 'hover:bg-surface0/80 text-subtext1 hover:text-text'
                                  }`}
                              >
                                <div className="flex flex-col min-w-0 pr-2">
                                  <span
                                    className="text-xs truncate"
                                    style={{ fontFamily: font.fontFamilyName }}
                                  >
                                    {font.fontFamilyName}
                                  </span>
                                  <span
                                    className="text-[10px] text-subtext0 truncate opacity-70 group-hover:opacity-100"
                                    style={{ fontFamily: font.fontFamilyName }}
                                  >
                                    const code = (a != b) =&gt; a &amp;&amp; b;
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {font.ligaturesSupport ? (
                                    <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 bg-surface0 text-subtext0 border border-surface1">
                                      <Sparkles className="w-2.5 h-2.5 text-text" />
                                      Ligatures
                                    </span>
                                  ) : (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-surface0 text-subtext0/70 border border-surface1">
                                      Mono
                                    </span>
                                  )}
                                  {isSelected && <Check className="w-3.5 h-3.5 text-text ml-1" />}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Font Size & BIU Formatting */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Font Size */}
                  <div>
                    <label
                      htmlFor="preferences-font-size-input"
                      className="block text-xs font-medium text-text mb-1.5"
                    >
                      Font Size (px)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="preferences-font-size-input"
                        type="number"
                        min="10"
                        max="24"
                        value={fontSize}
                        onChange={(e) =>
                          updateViewerFontSettings({
                            fontSize: Math.max(10, Math.min(24, parseInt(e.target.value) || 13)),
                          })
                        }
                        className="w-full px-3 py-2 bg-surface0/60 border border-surface0 text-text text-xs focus:outline-none focus:border-surface2"
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateViewerFontSettings({ fontSize: Math.max(10, fontSize - 1) })
                          }
                          className="px-2.5 py-2 rounded-lg border border-surface0 hover:bg-surface0 text-text text-xs cursor-pointer font-bold"
                          title="Decrease font size"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateViewerFontSettings({ fontSize: Math.min(24, fontSize + 1) })
                          }
                          className="px-2.5 py-2 rounded-lg border border-surface0 hover:bg-surface0 text-text text-xs cursor-pointer font-bold"
                          title="Increase font size"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* BIU Formatting Buttons */}
                  <div>
                    <span className="block text-xs font-medium text-text mb-1.5">
                      Font Styling (BIU)
                    </span>
                    <div className="flex items-center gap-1.5">
                      {/* Bold */}
                      <button
                        type="button"
                        onClick={() => updateViewerFontSettings({ isBold: !isBold })}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs transition-all cursor-pointer ${isBold
                            ? 'bg-surface1 border-surface2 text-text font-bold shadow-xs'
                            : 'bg-surface0/40 border-surface0 text-subtext0 hover:bg-surface0 hover:text-text'
                          }`}
                        title="Bold (Ctrl+B)"
                      >
                        <Bold className="w-3.5 h-3.5" />
                        <span>Bold</span>
                      </button>

                      {/* Italic */}
                      <button
                        type="button"
                        onClick={() => updateViewerFontSettings({ isItalic: !isItalic })}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs transition-all cursor-pointer ${isItalic
                            ? 'bg-surface1 border-surface2 text-text font-bold italic shadow-xs'
                            : 'bg-surface0/40 border-surface0 text-subtext0 hover:bg-surface0 hover:text-text'
                          }`}
                        title="Italic (Ctrl+I)"
                      >
                        <Italic className="w-3.5 h-3.5" />
                        <span>Italic</span>
                      </button>

                      {/* Underline */}
                      <button
                        type="button"
                        onClick={() => updateViewerFontSettings({ isUnderline: !isUnderline })}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs transition-all cursor-pointer ${isUnderline
                            ? 'bg-surface1 border-surface2 text-text font-bold underline shadow-xs'
                            : 'bg-surface0/40 border-surface0 text-subtext0 hover:bg-surface0 hover:text-text'
                          }`}
                        title="Underline (Ctrl+U)"
                      >
                        <Underline className="w-3.5 h-3.5" />
                        <span>Underline</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Line Spacing Slider */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="preferences-line-spacing-range"
                      className="text-xs font-medium text-text"
                    >
                      Line Spacing (Line Height)
                    </label>
                    <span className="text-xs font-mono font-bold text-text px-1.5 py-0.5 bg-surface1">
                      {lineSpacing}x
                    </span>
                  </div>
                  <input
                    id="preferences-line-spacing-range"
                    type="range"
                    min="1.1"
                    max="2.2"
                    step="0.1"
                    value={lineSpacing}
                    onChange={(e) =>
                      updateViewerFontSettings({
                        lineSpacing: parseFloat(e.target.value),
                      })
                    }
                    className="w-full h-1.5 bg-surface1 appearance-none cursor-pointer accent-text"
                  />
                  <div className="flex justify-between text-[10px] text-subtext0 mt-1 font-mono">
                    <span>1.1x</span>
                    <span>1.5x</span>
                    <span>2.2x</span>
                  </div>
                </div>

                {/* Ligatures Toggle */}
                <div className="bg-surface0/40 p-3.5 border border-surface0/80 flex items-center justify-between">
                  <div className="space-y-0.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text">
                        Enable Font Ligatures
                      </span>
                      {!currentFontSupportsLigatures && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-subtext0 bg-surface1 px-2 py-0.5 border border-surface2">
                          <AlertCircle className="w-3 h-3 text-subtext0" />
                          Unsupported by {fontFamily}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-subtext0 leading-relaxed">
                      Renders coding ligatures such as <code className="font-mono">=&gt;</code>,{' '}
                      <code className="font-mono">!==</code>, <code className="font-mono">&lt;=</code>,{' '}
                      <code className="font-mono">&gt;=</code>, <code className="font-mono">&amp;&amp;</code>
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!currentFontSupportsLigatures}
                      checked={enableLigatures && currentFontSupportsLigatures}
                      onChange={(e) =>
                        updateViewerFontSettings({ enableLigatures: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-surface1 peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text after:h-4 after:w-4 after:transition-all peer-checked:bg-surface2 peer-disabled:opacity-40 peer-disabled:cursor-not-allowed"></div>
                  </label>
                </div>

                {/* Live Interactive Preview Box */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text">Live Preview</span>
                    <span className="text-[10px] text-subtext0 font-mono">
                      {fontFamily} • {fontSize}px • {lineSpacing}x
                    </span>
                  </div>

                  <div
                    className="p-3.5 bg-crust border border-surface0/80 overflow-x-auto select-text shadow-inner"
                    style={{
                      fontFamily: `"${fontFamily}", monospace`,
                      fontSize: `${fontSize}px`,
                      fontWeight: isBold ? 700 : 400,
                      fontStyle: isItalic ? 'italic' : 'normal',
                      textDecoration: isUnderline ? 'underline' : 'none',
                      lineHeight: lineSpacing,
                      fontVariantLigatures:
                        enableLigatures && currentFontSupportsLigatures ? 'normal' : 'none',
                      fontFeatureSettings:
                        enableLigatures && currentFontSupportsLigatures
                          ? '"liga" 1, "calt" 1'
                          : '"liga" 0, "calt" 0',
                    }}
                  >
                    <div className="text-subtext0 text-[11px] mb-1 font-sans select-none">
                      // Sample Code &amp; Ligature Testing
                    </div>
                    <div className="text-text">
                      <span className="text-subtext0">const</span> isSimulated = (base !== compare) =&gt; &#123;
                    </div>
                    <div className="text-text pl-4">
                      <span className="text-subtext0">if</span> (target.status === <span className="text-subtext1">"CONFLICT"</span> &amp;&amp; count &gt;= 1) &#123;
                    </div>
                    <div className="text-text pl-8">
                      <span className="text-subtext0">return</span> base.version &lt;= 2.0 ? <span className="text-subtext1">"REBASE_REQUIRED"</span> : <span className="text-subtext1">"MERGE_CLEAN"</span>;
                    </div>
                    <div className="text-text pl-4">&#125;</div>
                    <div className="text-text">&#125;;</div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: GIT CREDENTIALS */}
            {activeTab === 'credentials' && (
              <div className="animate-in fade-in duration-100">
                <GitCredentialsTab />
              </div>
            )}

            {/* TAB 4: AI & MCP */}
            {activeTab === 'ai' && (
              <div className="animate-in fade-in duration-100">
                <AiMcpTab />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface0 flex items-center justify-between bg-base/60">
          <div>
            {activeTab === 'fonts' && (
              <button
                type="button"
                onClick={resetViewerFontSettings}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface0 hover:bg-surface0 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsPreferencesOpen(false)}
            className="px-5 py-1.5 bg-surface1 hover:bg-surface2 text-text font-semibold rounded-lg text-xs transition-colors cursor-pointer shadow-xs border border-surface2"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
