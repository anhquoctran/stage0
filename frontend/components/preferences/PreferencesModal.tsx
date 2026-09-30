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
  Cog,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Search,
  Monitor,
  Moon,
  Sun,
  Palette,
  Key,
  Bot,
  Box,
} from 'lucide-react';
import { SUPPORTED_FONTS } from '../../constants/fonts';
import {
  usePreferencesStore,
  checkFontLigaturesSupport,
  applyViewerFontToDocument,
  DEFAULT_VIEWER_FONT_SETTINGS,
  ViewerFontSettings,
} from '../../store/usePreferencesStore';
import {
  useThemeStore,
  ThemeMode,
  resolveTheme,
  applyThemeToDocument,
} from '../../store/useThemeStore';
import { GitCredentialsTab } from './GitCredentialsTab';
import { AiMcpTab } from './AiMcpTab';
import { SandboxTab } from './SandboxTab';
import { useGitStore } from '../../store/useGitStore';
import { useAiMcpStore } from '../../store/useAiMcpStore';
import { DEFAULT_AI_CONFIG } from '../../constants/aiPresets';
import { AiConfig } from '../../types/ai';
import { SandboxType } from '../../types/git';

type PreferenceTab = 'appearance' | 'fonts' | 'credentials' | 'ai' | 'sandbox';

interface PreferencesBaseline {
  themeMode: ThemeMode;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  lineSpacing: number;
  enableLigatures: boolean;
  showInlineBlame: boolean;
  sandboxType: SandboxType;
  aiConfig: AiConfig;
}

export const PreferencesModal: React.FC = () => {
  const {
    isPreferencesOpen,
    setIsPreferencesOpen,
    fontFamily: storedFontFamily,
    fontSize: storedFontSize,
    isBold: storedIsBold,
    isItalic: storedIsItalic,
    isUnderline: storedIsUnderline,
    lineSpacing: storedLineSpacing,
    enableLigatures: storedEnableLigatures,
    updateViewerFontSettings,
    showInlineBlame: storedShowInlineBlame,
    setShowInlineBlame,
  } = usePreferencesStore();

  const { themeMode: storedThemeMode, setThemeMode } = useThemeStore();
  const {
    activeSandboxType: storedSandboxType,
    setActiveSandbox,
    showToast,
  } = useGitStore();
  const {
    aiConfig: storedAiConfig,
    updateAiConfig,
    resetAiConfig,
  } = useAiMcpStore();

  const [activeTab, setActiveTab] = useState<PreferenceTab>('appearance');

  // Draft State (for PreferenceTransaction)
  const [draftThemeMode, setDraftThemeMode] = useState<ThemeMode>(storedThemeMode);
  const [draftFontFamily, setDraftFontFamily] = useState(storedFontFamily);
  const [draftFontSize, setDraftFontSize] = useState(storedFontSize);
  const [draftIsBold, setDraftIsBold] = useState(storedIsBold);
  const [draftIsItalic, setDraftIsItalic] = useState(storedIsItalic);
  const [draftIsUnderline, setDraftIsUnderline] = useState(storedIsUnderline);
  const [draftLineSpacing, setDraftLineSpacing] = useState(storedLineSpacing);
  const [draftEnableLigatures, setDraftEnableLigatures] = useState(storedEnableLigatures);
  const [draftShowInlineBlame, setDraftShowInlineBlame] = useState(storedShowInlineBlame);
  const [draftSandboxType, setDraftSandboxType] = useState<SandboxType>(storedSandboxType);
  const [draftAiConfig, setDraftAiConfig] = useState<AiConfig>({ ...storedAiConfig });

  // Baseline Snapshot (committed values)
  const [savedBaseline, setSavedBaseline] = useState<PreferencesBaseline>({
    themeMode: storedThemeMode,
    fontFamily: storedFontFamily,
    fontSize: storedFontSize,
    isBold: storedIsBold,
    isItalic: storedIsItalic,
    isUnderline: storedIsUnderline,
    lineSpacing: storedLineSpacing,
    enableLigatures: storedEnableLigatures,
    showInlineBlame: storedShowInlineBlame,
    sandboxType: storedSandboxType,
    aiConfig: { ...storedAiConfig },
  });

  const [isApplied, setIsApplied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Synchronize draft states and baseline whenever modal is opened
  useEffect(() => {
    if (isPreferencesOpen) {
      setDraftThemeMode(storedThemeMode);
      setDraftFontFamily(storedFontFamily);
      setDraftFontSize(storedFontSize);
      setDraftIsBold(storedIsBold);
      setDraftIsItalic(storedIsItalic);
      setDraftIsUnderline(storedIsUnderline);
      setDraftLineSpacing(storedLineSpacing);
      setDraftEnableLigatures(storedEnableLigatures);
      setDraftShowInlineBlame(storedShowInlineBlame);
      setDraftSandboxType(storedSandboxType);
      setDraftAiConfig({ ...storedAiConfig });

      setSavedBaseline({
        themeMode: storedThemeMode,
        fontFamily: storedFontFamily,
        fontSize: storedFontSize,
        isBold: storedIsBold,
        isItalic: storedIsItalic,
        isUnderline: storedIsUnderline,
        lineSpacing: storedLineSpacing,
        enableLigatures: storedEnableLigatures,
        showInlineBlame: storedShowInlineBlame,
        sandboxType: storedSandboxType,
        aiConfig: { ...storedAiConfig },
      });

      setIsApplied(false);
      setShowResetConfirm(false);
    }
  }, [
    isPreferencesOpen,
    storedThemeMode,
    storedFontFamily,
    storedFontSize,
    storedIsBold,
    storedIsItalic,
    storedIsUnderline,
    storedLineSpacing,
    storedEnableLigatures,
    storedShowInlineBlame,
    storedSandboxType,
    storedAiConfig,
  ]);

  // Track unsaved changes per domain and in total
  const unsavedBreakdown = useMemo(() => {
    let appearance = 0;
    if (draftThemeMode !== savedBaseline.themeMode) appearance++;

    let fonts = 0;
    if (draftFontFamily !== savedBaseline.fontFamily) fonts++;
    if (draftFontSize !== savedBaseline.fontSize) fonts++;
    if (draftIsBold !== savedBaseline.isBold) fonts++;
    if (draftIsItalic !== savedBaseline.isItalic) fonts++;
    if (draftIsUnderline !== savedBaseline.isUnderline) fonts++;
    if (draftLineSpacing !== savedBaseline.lineSpacing) fonts++;
    if (draftEnableLigatures !== savedBaseline.enableLigatures) fonts++;
    if (draftShowInlineBlame !== savedBaseline.showInlineBlame) fonts++;

    let sandbox = 0;
    if (draftSandboxType !== savedBaseline.sandboxType) sandbox++;

    let ai = 0;
    if (draftAiConfig.provider !== savedBaseline.aiConfig.provider) ai++;
    if (draftAiConfig.model !== savedBaseline.aiConfig.model) ai++;
    if (draftAiConfig.apiKey !== savedBaseline.aiConfig.apiKey) ai++;
    if (draftAiConfig.baseUrl !== savedBaseline.aiConfig.baseUrl) ai++;
    if (draftAiConfig.temperature !== savedBaseline.aiConfig.temperature) ai++;
    if (draftAiConfig.maxTokens !== savedBaseline.aiConfig.maxTokens) ai++;
    if (draftAiConfig.streamResponse !== savedBaseline.aiConfig.streamResponse) ai++;
    if (draftAiConfig.enableCodeReviewAssist !== savedBaseline.aiConfig.enableCodeReviewAssist) ai++;
    if (draftAiConfig.systemPrompt !== savedBaseline.aiConfig.systemPrompt) ai++;

    const total = appearance + fonts + sandbox + ai;
    return { appearance, fonts, sandbox, ai, total };
  }, [
    draftThemeMode,
    draftFontFamily,
    draftFontSize,
    draftIsBold,
    draftIsItalic,
    draftIsUnderline,
    draftLineSpacing,
    draftEnableLigatures,
    draftShowInlineBlame,
    draftSandboxType,
    draftAiConfig,
    savedBaseline,
  ]);

  const totalUnsaved = unsavedBreakdown.total;
  const hasUnsavedChanges = totalUnsaved > 0;

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

  // Theme selection handler with instant preview
  const handleSelectTheme = (mode: ThemeMode) => {
    setDraftThemeMode(mode);
    applyThemeToDocument(resolveTheme(mode));
  };

  // Reset to default action with immediate commit
  const handleConfirmResetToDefault = async () => {
    // 1. Commit Theme default
    setThemeMode('system');
    applyThemeToDocument(resolveTheme('system'));
    setDraftThemeMode('system');

    // 2. Commit Font defaults
    updateViewerFontSettings(DEFAULT_VIEWER_FONT_SETTINGS);
    applyViewerFontToDocument(DEFAULT_VIEWER_FONT_SETTINGS);
    setDraftFontFamily(DEFAULT_VIEWER_FONT_SETTINGS.fontFamily);
    setDraftFontSize(DEFAULT_VIEWER_FONT_SETTINGS.fontSize);
    setDraftIsBold(DEFAULT_VIEWER_FONT_SETTINGS.isBold);
    setDraftIsItalic(DEFAULT_VIEWER_FONT_SETTINGS.isItalic);
    setDraftIsUnderline(DEFAULT_VIEWER_FONT_SETTINGS.isUnderline);
    setDraftLineSpacing(DEFAULT_VIEWER_FONT_SETTINGS.lineSpacing);
    setDraftEnableLigatures(DEFAULT_VIEWER_FONT_SETTINGS.enableLigatures);

    // 3. Commit Blame default
    setShowInlineBlame(true);
    setDraftShowInlineBlame(true);

    // 4. Commit Sandbox default
    await setActiveSandbox('in_memory');
    setDraftSandboxType('in_memory');

    // 5. Commit AI default
    resetAiConfig();
    setDraftAiConfig({ ...DEFAULT_AI_CONFIG });

    // 6. Update savedBaseline to defaults immediately (unsavedCount becomes 0, no badge)
    setSavedBaseline({
      themeMode: 'system',
      ...DEFAULT_VIEWER_FONT_SETTINGS,
      showInlineBlame: true,
      sandboxType: 'in_memory',
      aiConfig: { ...DEFAULT_AI_CONFIG },
    });

    setShowResetConfirm(false);
    showToast('All preferences have been reset to defaults and committed');
  };

  // Apply (commit all transaction changes)
  const handleApply = async () => {
    const committedFontSettings: ViewerFontSettings = {
      fontFamily: draftFontFamily,
      fontSize: draftFontSize,
      isBold: draftIsBold,
      isItalic: draftIsItalic,
      isUnderline: draftIsUnderline,
      lineSpacing: draftLineSpacing,
      enableLigatures: draftEnableLigatures,
    };

    // Commit to stores & persistent storage
    updateViewerFontSettings(committedFontSettings);
    applyViewerFontToDocument(committedFontSettings);

    setThemeMode(draftThemeMode);
    applyThemeToDocument(resolveTheme(draftThemeMode));
    setShowInlineBlame(draftShowInlineBlame);

    // Commit sandbox engine if changed
    if (draftSandboxType !== savedBaseline.sandboxType) {
      await setActiveSandbox(draftSandboxType);
    }

    // Commit AI configuration
    updateAiConfig(draftAiConfig);

    // Update baseline to match committed drafts
    setSavedBaseline({
      themeMode: draftThemeMode,
      ...committedFontSettings,
      showInlineBlame: draftShowInlineBlame,
      sandboxType: draftSandboxType,
      aiConfig: { ...draftAiConfig },
    });

    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 1500);
  };

  // OK (commit all transaction changes then close)
  const handleOk = async () => {
    await handleApply();
    setIsPreferencesOpen(false);
  };

  // Cancel (close without saving, rollback safely)
  const handleCancel = () => {
    // Rollback any live previews to baseline
    applyThemeToDocument(resolveTheme(savedBaseline.themeMode));
    applyViewerFontToDocument(savedBaseline);

    // Rollback stores
    setThemeMode(savedBaseline.themeMode);
    updateViewerFontSettings(savedBaseline);
    setShowInlineBlame(savedBaseline.showInlineBlame);

    // Rollback draft states to baseline
    setDraftThemeMode(savedBaseline.themeMode);
    setDraftFontFamily(savedBaseline.fontFamily);
    setDraftFontSize(savedBaseline.fontSize);
    setDraftIsBold(savedBaseline.isBold);
    setDraftIsItalic(savedBaseline.isItalic);
    setDraftIsUnderline(savedBaseline.isUnderline);
    setDraftLineSpacing(savedBaseline.lineSpacing);
    setDraftEnableLigatures(savedBaseline.enableLigatures);
    setDraftShowInlineBlame(savedBaseline.showInlineBlame);
    setDraftSandboxType(savedBaseline.sandboxType);
    setDraftAiConfig({ ...savedBaseline.aiConfig });

    setIsPreferencesOpen(false);
  };

  // Keyboard navigation & Esc listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPreferencesOpen && !isFontDropdownOpen) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreferencesOpen, isFontDropdownOpen, savedBaseline]);

  if (!isPreferencesOpen) return null;

  const currentFontSupportsLigatures = checkFontLigaturesSupport(draftFontFamily);
  const selectedFontObj = SUPPORTED_FONTS.find(
    (f) => f.fontFamilyName.toLowerCase() === draftFontFamily.toLowerCase()
  ) || { fontFamilyName: draftFontFamily, ligaturesSupport: currentFontSupportsLigatures };

  const tabs: {
    id: PreferenceTab;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    unsavedCount?: number;
  }[] = [
    {
      id: 'appearance',
      label: 'Appearance',
      sublabel: 'Theme & Colors',
      icon: <Palette className="w-4 h-4" />,
      unsavedCount: unsavedBreakdown.appearance,
    },
    {
      id: 'fonts',
      label: 'Viewer Fonts',
      sublabel: 'Diff & Raw Typography',
      icon: <Type className="w-4 h-4" />,
      unsavedCount: unsavedBreakdown.fonts,
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
      unsavedCount: unsavedBreakdown.ai,
    },
    {
      id: 'sandbox',
      label: 'Sandbox Engine',
      sublabel: 'InMemory / Worktree / Docker',
      icon: <Box className="w-4 h-4" />,
      unsavedCount: unsavedBreakdown.sandbox,
    },
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-crust/75 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-mantle border border-surface0 w-full max-w-5xl xl:max-w-6xl shadow-2xl overflow-hidden flex flex-col h-[760px] max-h-[92vh] min-h-[580px] animate-in zoom-in-95 duration-150">
        {/* Header with Title and Unsaved Badge */}
        <div
          data-tauri-drag-region
          className="px-6 py-3.5 border-b border-surface0 flex items-center justify-between bg-base/60 cursor-default"
        >
          <div data-tauri-drag-region className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-7 h-7 bg-surface0 border border-surface1 flex items-center justify-center text-text shadow-xs">
              <Cog className="w-4 h-4 text-subtext0" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text">Preferences</h2>
              <p className="text-[11px] text-subtext0">
                Configure Appearance, Viewer Typography, Sandbox Engine, and AI
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            className="p-1.5 rounded-lg hover:bg-surface0 text-subtext0 hover:text-text transition-colors cursor-pointer"
            title="Cancel and close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Vertical Tabbed Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Vertical Sidebar Tabs (Left) */}
          <div className="w-60 bg-base/40 border-r border-surface0 flex flex-col shrink-0 select-none">
            <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-subtext0/70 border-b border-surface0/40">
              Settings
            </div>

            <div className="flex flex-col">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-all cursor-pointer border-l-2 ${
                      isActive
                        ? 'bg-brand/10 text-brand font-semibold border-l-brand'
                        : 'border-l-transparent text-subtext0 hover:bg-surface0/50 hover:text-text'
                    }`}
                  >
                    <div
                      className={`mt-0.5 shrink-0 ${
                        isActive ? 'text-brand' : 'text-subtext0'
                      }`}
                    >
                      {tab.icon}
                    </div>
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="text-xs font-semibold leading-tight truncate">
                        {tab.label}
                      </div>
                      <div className="text-[10px] text-subtext0/80 leading-normal truncate mt-0.5">
                        {tab.sublabel}
                      </div>
                    </div>
                    {Boolean(tab.unsavedCount && tab.unsavedCount > 0) && (
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full bg-surface2 text-text border border-surface1 shrink-0">
                        {tab.unsavedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
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

                <div className="p-4 bg-surface0/30 border border-surface0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-text block">Interface Theme</span>
                      <span className="text-[11px] text-subtext0 block mt-0.5">
                        {draftThemeMode === 'system'
                          ? 'Synchronized with your operating system color scheme'
                          : draftThemeMode === 'dark'
                          ? 'Catppuccin Mocha aesthetic dark theme'
                          : 'Catppuccin Latte clean light theme'}
                      </span>
                    </div>

                    {/* 3-Step Compact Button Group */}
                    <div className="inline-flex items-center p-0.5 bg-base border border-surface1 gap-0.5 shadow-inner">
                      <button
                        type="button"
                        onClick={() => handleSelectTheme('system')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                          draftThemeMode === 'system'
                            ? 'bg-surface2 text-text font-semibold shadow-xs'
                            : 'text-subtext0 hover:text-text hover:bg-surface0'
                        }`}
                        title="Sync with Operating System theme"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                        <span>System</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectTheme('dark')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                          draftThemeMode === 'dark'
                            ? 'bg-surface2 text-text font-semibold shadow-xs'
                            : 'text-subtext0 hover:text-text hover:bg-surface0'
                        }`}
                        title="Catppuccin Mocha dark theme"
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>Dark</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectTheme('light')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                          draftThemeMode === 'light'
                            ? 'bg-surface2 text-text font-semibold shadow-xs'
                            : 'text-subtext0 hover:text-text hover:bg-surface0'
                        }`}
                        title="Catppuccin Latte light theme"
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span>Light</span>
                      </button>
                    </div>
                  </div>
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
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
                      isFontDropdownOpen
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
                      className={`w-4 h-4 text-subtext0 transition-transform duration-200 shrink-0 ${
                        isFontDropdownOpen ? 'rotate-180 text-text' : ''
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
                              draftFontFamily.toLowerCase() === font.fontFamilyName.toLowerCase();

                            return (
                              <div
                                key={font.fontFamilyName}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setDraftFontFamily(font.fontFamilyName);
                                  setDraftEnableLigatures(font.ligaturesSupport);
                                  setIsFontDropdownOpen(false);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setDraftFontFamily(font.fontFamilyName);
                                    setDraftEnableLigatures(font.ligaturesSupport);
                                    setIsFontDropdownOpen(false);
                                  }
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer group ${
                                  isSelected
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
                        value={draftFontSize}
                        onChange={(e) =>
                          setDraftFontSize(
                            Math.max(10, Math.min(24, parseInt(e.target.value) || 13))
                          )
                        }
                        className="w-20 px-3 py-1.5 bg-base border border-surface1 text-xs text-text focus:outline-none focus:border-surface2 font-mono"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDraftFontSize((prev) => Math.max(10, prev - 1))}
                          className="px-2.5 py-2 rounded-lg border border-surface0 hover:bg-surface0 text-text text-xs cursor-pointer font-bold"
                          title="Decrease font size"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraftFontSize((prev) => Math.min(24, prev + 1))}
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
                        onClick={() => setDraftIsBold(!draftIsBold)}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs transition-all cursor-pointer ${
                          draftIsBold
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
                        onClick={() => setDraftIsItalic(!draftIsItalic)}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs transition-all cursor-pointer ${
                          draftIsItalic
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
                        onClick={() => setDraftIsUnderline(!draftIsUnderline)}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs transition-all cursor-pointer ${
                          draftIsUnderline
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
                      {draftLineSpacing}x
                    </span>
                  </div>
                  <input
                    id="preferences-line-spacing-range"
                    type="range"
                    min="1.1"
                    max="2.2"
                    step="0.1"
                    value={draftLineSpacing}
                    onChange={(e) => setDraftLineSpacing(parseFloat(e.target.value))}
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
                          Unsupported by {draftFontFamily}
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
                      checked={draftEnableLigatures && currentFontSupportsLigatures}
                      onChange={(e) => setDraftEnableLigatures(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-surface1 peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text after:h-4 after:w-4 after:transition-all peer-checked:bg-surface2 peer-disabled:opacity-40 peer-disabled:cursor-not-allowed"></div>
                  </label>
                </div>

                {/* Inline Git Blame Toggle */}
                <div className="bg-surface0/40 p-3.5 border border-surface0/80 flex items-center justify-between">
                  <div className="space-y-0.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text">
                        Inline Git Blame (VSCode Style)
                      </span>
                    </div>
                    <p className="text-[11px] text-subtext0 leading-relaxed">
                      Show commit author, relative time, and summary annotation at the end of the active line in diff view (Alt+Shift+B).
                    </p>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftShowInlineBlame}
                      onChange={(e) => setDraftShowInlineBlame(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-surface1 peer-focus:outline-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text after:h-4 after:w-4 after:transition-all peer-checked:bg-surface2"></div>
                  </label>
                </div>

                {/* Live Interactive Preview Box */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text">Live Preview</span>
                    <span className="text-[10px] text-subtext0 font-mono">
                      {draftFontFamily} • {draftFontSize}px • {draftLineSpacing}x
                    </span>
                  </div>

                  <div
                    className="p-3.5 bg-crust border border-surface0/80 overflow-x-auto select-text shadow-inner"
                    style={{
                      fontFamily: `"${draftFontFamily}", monospace`,
                      fontSize: `${draftFontSize}px`,
                      fontWeight: draftIsBold ? 700 : 400,
                      fontStyle: draftIsItalic ? 'italic' : 'normal',
                      textDecoration: draftIsUnderline ? 'underline' : 'none',
                      lineHeight: draftLineSpacing,
                      fontVariantLigatures:
                        draftEnableLigatures && currentFontSupportsLigatures ? 'normal' : 'none',
                      fontFeatureSettings:
                        draftEnableLigatures && currentFontSupportsLigatures
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
                <AiMcpTab
                  draftAiConfig={draftAiConfig}
                  onUpdateAiConfig={(partial) =>
                    setDraftAiConfig((prev) => ({ ...prev, ...partial }))
                  }
                />
              </div>
            )}

            {/* TAB 5: SANDBOX ENGINE */}
            {activeTab === 'sandbox' && (
              <div className="animate-in fade-in duration-100">
                <SandboxTab
                  draftSandboxType={draftSandboxType}
                  onSelectAdapter={setDraftSandboxType}
                  isPendingCommit={draftSandboxType !== savedBaseline.sandboxType}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer: Reset to default on the left, Cancel, Apply, OK on the right */}
        <div className="px-6 py-3 border-t border-surface0 flex items-center justify-between bg-base/60 select-none">
          {/* Left: Reset to default & Transaction Indicator */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface1 hover:bg-surface0 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
              title="Reset all settings to application defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to default</span>
            </button>

            {totalUnsaved > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] font-mono text-subtext0 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-subtext0" />
                <span>{totalUnsaved} unsaved</span>
              </span>
            )}
          </div>

          {/* Right: Cancel, Apply, OK */}
          <div className="flex items-center gap-2">
            {/* Cancel (close without saving) */}
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer font-medium"
              title="Close without saving"
            >
              Cancel
            </button>

            {/* Apply (save only) */}
            <button
              type="button"
              onClick={handleApply}
              disabled={!hasUnsavedChanges && !isApplied}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                isApplied
                  ? 'bg-surface2 text-text border-surface1'
                  : hasUnsavedChanges
                  ? 'bg-surface1 hover:bg-surface2 text-text border-surface2 shadow-xs'
                  : 'bg-surface0/40 text-subtext0/50 border-surface0 cursor-not-allowed'
              }`}
              title="Save changes and keep window open"
            >
              {isApplied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-text" />
                  <span>Applied</span>
                </>
              ) : (
                <span>Apply</span>
              )}
            </button>

            {/* OK (save then close) */}
            <button
              type="button"
              onClick={handleOk}
              className="px-5 py-1.5 bg-brand hover:bg-brand/90 text-[#11111b] font-semibold text-xs transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand"
              title="Save changes and close window"
            >
              OK
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Reset to Defaults */}
      {showResetConfirm && (
        <div className="fixed inset-x-0 bottom-0 top-8.5 z-[60] bg-crust/70 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-100">
          <div className="bg-mantle border border-surface0 max-w-md w-full p-5 rounded-xl shadow-2xl space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-surface0 border border-surface1 text-subtext0 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Reset all preferences to default?</h3>
                <p className="text-xs text-subtext0 mt-1 leading-relaxed">
                  This will immediately reset all settings (Theme, Viewer Fonts, Inline Blame, Sandbox Engine, and AI Configuration) to application defaults and commit them.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface0/60">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-lg border border-surface1 hover:bg-surface0 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetToDefault}
                className="px-3.5 py-1.5 rounded-lg bg-red text-white text-xs font-semibold hover:bg-red/90 transition-colors cursor-pointer shadow-xs"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
