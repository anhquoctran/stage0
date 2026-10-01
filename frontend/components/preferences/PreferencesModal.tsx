import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  Monitor,
  Moon,
  Sun,
  AlertCircle,
  AlertTriangle,
  Bold,
  Italic,
  Underline,
} from '@/components/common/icons';
import { SUPPORTED_FONTS } from '../../constants/fonts';
import { formatShortcutText } from '../../utils/shortcuts';
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
import { BotReviewersTab } from './BotReviewersTab';
import { SandboxTab } from './SandboxTab';
import { GitBinaryTab } from './GitBinaryTab';
import { GuardrailsTab } from './GuardrailsTab';
import { useGitStore } from '../../store/useGitStore';
import { useAiMcpStore } from '../../store/useAiMcpStore';
import { useGitBinaryStore } from '../../store/useGitBinaryStore';
import { DEFAULT_AI_CONFIG } from '../../constants/aiPresets';
import { AiConfig } from '../../types/ai';
import { SandboxType } from '../../types/git';

export type PreferenceTab =
  | 'general'
  | 'appearance'
  | 'fonts'
  | 'git'
  | 'credentials'
  | 'sandbox'
  | 'ai'
  | 'reviewers'
  | 'guardrails';

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
  gitBinaryId: string;
  gitBinaryPath: string;
}

interface PreferenceCategory {
  id: PreferenceTab;
  label: string;
  title: string;
  description: string;
  keywords: string[];
  unsavedCount?: number;
}

// Zed-inspired sleek toggle switch
interface ZedSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
}

const ZedSwitch: React.FC<ZedSwitchProps> = ({ checked, onChange, disabled, id }) => {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
        disabled
          ? 'opacity-40 cursor-not-allowed bg-surface1'
          : checked
          ? 'bg-[#238636]'
          : 'bg-surface2 hover:bg-surface3'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
          checked ? 'translate-x-4.5' : 'translate-x-0.75'
        }`}
      />
    </button>
  );
};

// Zed-inspired setting row
interface SettingRowProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  borderBottom?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = ({
  title,
  description,
  children,
  borderBottom = true,
}) => {
  return (
    <div
      className={`py-3.5 flex items-center justify-between gap-6 ${
        borderBottom ? 'border-b border-[#313244]/40' : ''
      }`}
    >
      <div className="min-w-0 flex-1 pr-2">
        <div className="text-xs font-semibold text-text">{title}</div>
        {description && (
          <div className="text-[11px] text-subtext0 mt-0.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
};

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
  const {
    activeBinaryId: storedGitBinaryId,
    activeBinaryPath: storedGitBinaryPath,
    fetchActiveBinary,
    setActiveBinary,
    restartApp,
  } = useGitBinaryStore();

  const [activeTab, setActiveTab] = useState<PreferenceTab>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const sidebarSearchInputRef = useRef<HTMLInputElement>(null);

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
  const [draftGitBinaryId, setDraftGitBinaryId] = useState(storedGitBinaryId);
  const [draftGitBinaryPath, setDraftGitBinaryPath] = useState(storedGitBinaryPath);

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
    gitBinaryId: storedGitBinaryId,
    gitBinaryPath: storedGitBinaryPath,
  });

  const [isApplied, setIsApplied] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);

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
      setDraftGitBinaryId(storedGitBinaryId);
      setDraftGitBinaryPath(storedGitBinaryPath);

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
        gitBinaryId: storedGitBinaryId,
        gitBinaryPath: storedGitBinaryPath,
      });

      // Also ensure latest active git binary is fetched from backend
      fetchActiveBinary().then((res) => {
        setDraftGitBinaryId(res.id);
        setDraftGitBinaryPath(res.path);
        setSavedBaseline((prev) => ({
          ...prev,
          gitBinaryId: res.id,
          gitBinaryPath: res.path,
        }));
      });

      setIsApplied(false);
      setShowResetConfirm(false);
      setShowRestartPrompt(false);
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
    storedGitBinaryId,
    storedGitBinaryPath,
  ]);

  // Track unsaved changes per domain and in total
  const unsavedBreakdown = useMemo(() => {
    let general = 0;
    if (draftShowInlineBlame !== savedBaseline.showInlineBlame) general++;
    if (draftAiConfig.streamResponse !== savedBaseline.aiConfig.streamResponse) general++;
    if (draftAiConfig.enableCodeReviewAssist !== savedBaseline.aiConfig.enableCodeReviewAssist) general++;

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

    let sandbox = 0;
    if (draftSandboxType !== savedBaseline.sandboxType) sandbox++;

    let ai = 0;
    if (draftAiConfig.provider !== savedBaseline.aiConfig.provider) ai++;
    if (draftAiConfig.model !== savedBaseline.aiConfig.model) ai++;
    if (draftAiConfig.apiKey !== savedBaseline.aiConfig.apiKey) ai++;
    if (draftAiConfig.baseUrl !== savedBaseline.aiConfig.baseUrl) ai++;
    if (draftAiConfig.temperature !== savedBaseline.aiConfig.temperature) ai++;
    if (draftAiConfig.maxTokens !== savedBaseline.aiConfig.maxTokens) ai++;
    if (draftAiConfig.systemPrompt !== savedBaseline.aiConfig.systemPrompt) ai++;

    let git = 0;
    if (
      draftGitBinaryId !== savedBaseline.gitBinaryId ||
      draftGitBinaryPath !== savedBaseline.gitBinaryPath
    ) {
      git++;
    }

    const total = general + appearance + fonts + sandbox + ai + git;
    return { general, appearance, fonts, sandbox, ai, git, total };
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
    draftGitBinaryId,
    draftGitBinaryPath,
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

  // Focus search input when font dropdown opens
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
    setThemeMode('system');
    applyThemeToDocument(resolveTheme('system'));
    setDraftThemeMode('system');

    updateViewerFontSettings(DEFAULT_VIEWER_FONT_SETTINGS);
    applyViewerFontToDocument(DEFAULT_VIEWER_FONT_SETTINGS);
    setDraftFontFamily(DEFAULT_VIEWER_FONT_SETTINGS.fontFamily);
    setDraftFontSize(DEFAULT_VIEWER_FONT_SETTINGS.fontSize);
    setDraftIsBold(DEFAULT_VIEWER_FONT_SETTINGS.isBold);
    setDraftIsItalic(DEFAULT_VIEWER_FONT_SETTINGS.isItalic);
    setDraftIsUnderline(DEFAULT_VIEWER_FONT_SETTINGS.isUnderline);
    setDraftLineSpacing(DEFAULT_VIEWER_FONT_SETTINGS.lineSpacing);
    setDraftEnableLigatures(DEFAULT_VIEWER_FONT_SETTINGS.enableLigatures);

    setShowInlineBlame(true);
    setDraftShowInlineBlame(true);

    await setActiveSandbox('in_memory');
    setDraftSandboxType('in_memory');

    resetAiConfig();
    setDraftAiConfig({ ...DEFAULT_AI_CONFIG });

    setDraftGitBinaryId('system-default');
    setDraftGitBinaryPath('git');
    await setActiveBinary('system-default', 'git');

    setSavedBaseline({
      themeMode: 'system',
      ...DEFAULT_VIEWER_FONT_SETTINGS,
      showInlineBlame: true,
      sandboxType: 'in_memory',
      aiConfig: { ...DEFAULT_AI_CONFIG },
      gitBinaryId: 'system-default',
      gitBinaryPath: 'git',
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

    updateViewerFontSettings(committedFontSettings);
    applyViewerFontToDocument(committedFontSettings);

    setThemeMode(draftThemeMode);
    applyThemeToDocument(resolveTheme(draftThemeMode));
    setShowInlineBlame(draftShowInlineBlame);

    if (draftSandboxType !== savedBaseline.sandboxType) {
      await setActiveSandbox(draftSandboxType);
    }

    updateAiConfig(draftAiConfig);

    let gitChanged = false;
    if (
      draftGitBinaryId !== savedBaseline.gitBinaryId ||
      draftGitBinaryPath !== savedBaseline.gitBinaryPath
    ) {
      await setActiveBinary(draftGitBinaryId, draftGitBinaryPath);
      gitChanged = true;
    }

    setSavedBaseline({
      themeMode: draftThemeMode,
      ...committedFontSettings,
      showInlineBlame: draftShowInlineBlame,
      sandboxType: draftSandboxType,
      aiConfig: { ...draftAiConfig },
      gitBinaryId: draftGitBinaryId,
      gitBinaryPath: draftGitBinaryPath,
    });

    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 1500);

    if (gitChanged) {
      setShowRestartPrompt(true);
    }
  };

  // OK (commit all transaction changes then close or prompt restart)
  const handleOk = async () => {
    const gitChanged =
      draftGitBinaryId !== savedBaseline.gitBinaryId ||
      draftGitBinaryPath !== savedBaseline.gitBinaryPath;
    await handleApply();
    if (gitChanged) {
      setShowRestartPrompt(true);
    } else {
      setIsPreferencesOpen(false);
    }
  };

  // Cancel (close without saving, rollback safely)
  const handleCancel = () => {
    applyThemeToDocument(resolveTheme(savedBaseline.themeMode));
    applyViewerFontToDocument(savedBaseline);

    setThemeMode(savedBaseline.themeMode);
    updateViewerFontSettings(savedBaseline);
    setShowInlineBlame(savedBaseline.showInlineBlame);

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
    setDraftGitBinaryId(savedBaseline.gitBinaryId);
    setDraftGitBinaryPath(savedBaseline.gitBinaryPath);
    setShowRestartPrompt(false);

    setIsPreferencesOpen(false);
  };

  // Keyboard navigation, Esc listener, and Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPreferencesOpen) return;

      if (e.key === 'Escape' && !isFontDropdownOpen && !showRestartPrompt && !showResetConfirm) {
        handleCancel();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleApply();
      }

      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        sidebarSearchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreferencesOpen, isFontDropdownOpen, showRestartPrompt, showResetConfirm, savedBaseline, draftThemeMode, draftFontFamily, draftFontSize, draftIsBold, draftIsItalic, draftIsUnderline, draftLineSpacing, draftEnableLigatures, draftShowInlineBlame, draftSandboxType, draftAiConfig, draftGitBinaryId, draftGitBinaryPath]);

  // Categories definition
  const categories: PreferenceCategory[] = useMemo(() => [
    {
      id: 'general',
      label: 'General',
      title: 'General',
      description: 'General editor settings, inline blame, and AI assistance',
      keywords: ['general', 'blame', 'stream', 'review', 'assist', 'accessible'],
      unsavedCount: unsavedBreakdown.general,
    },
    {
      id: 'appearance',
      label: 'Appearance',
      title: 'Appearance',
      description: 'User interface themes, dark mode, and color scheme',
      keywords: ['appearance', 'theme', 'dark', 'light', 'system', 'color'],
      unsavedCount: unsavedBreakdown.appearance,
    },
    {
      id: 'fonts',
      label: 'Editor & Fonts',
      title: 'Editor & Fonts',
      description: 'Typography, font family, ligatures, and line spacing for diffs and code viewer',
      keywords: ['fonts', 'editor', 'typography', 'size', 'monospace', 'ligature', 'line spacing', 'preview'],
      unsavedCount: unsavedBreakdown.fonts,
    },
    {
      id: 'git',
      label: 'Version Control',
      title: 'Version Control',
      description: 'Git executable binary configuration and active path',
      keywords: ['git', 'version control', 'executable', 'binary', 'path', 'system', 'bundled'],
      unsavedCount: unsavedBreakdown.git,
    },
    {
      id: 'credentials',
      label: 'Git Credentials',
      title: 'Git Credentials',
      description: 'OS Keychain, credential helpers, and personal access tokens',
      keywords: ['credentials', 'git', 'token', 'pat', 'auth', 'keyring', 'github', 'gitlab'],
    },
    {
      id: 'sandbox',
      label: 'Sandbox Engine',
      title: 'Sandbox Engine',
      description: 'Worktree isolation, In-Memory staging, and Docker containers',
      keywords: ['sandbox', 'worktree', 'docker', 'container', 'in_memory', 'isolation'],
      unsavedCount: unsavedBreakdown.sandbox,
    },
    {
      id: 'ai',
      label: 'AI & MCP',
      title: 'AI & MCP',
      description: 'LLM providers, API keys, models, and Model Context Protocol servers',
      keywords: ['ai', 'mcp', 'models', 'providers', 'openai', 'anthropic', 'gemini', 'ollama', 'servers'],
      unsavedCount: unsavedBreakdown.ai,
    },
    {
      id: 'reviewers',
      label: 'Bot Reviewers',
      title: 'Bot Reviewers',
      description: 'Global AI reviewer agents, prompts, and personas',
      keywords: ['bot', 'reviewers', 'agents', 'personas', 'prompts'],
    },
    {
      id: 'guardrails',
      label: 'Security Guardrails',
      title: 'Security Guardrails',
      description: 'Tool execution policies, command whitelist, audit log, and sandbox simulator',
      keywords: ['guardrails', 'security', 'whitelist', 'simulator', 'blocked', 'audit', 'commands'],
    },
  ], [unsavedBreakdown]);

  // Filtered categories based on search input
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter(
      (cat) =>
        cat.label.toLowerCase().includes(q) ||
        cat.title.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q) ||
        cat.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [searchQuery, categories]);

  if (!isPreferencesOpen) return null;

  const currentCategory = categories.find((c) => c.id === activeTab) || categories[0];
  const currentFontSupportsLigatures = checkFontLigaturesSupport(draftFontFamily);
  const selectedFontObj = SUPPORTED_FONTS.find(
    (f) => f.fontFamilyName.toLowerCase() === draftFontFamily.toLowerCase()
  ) || { fontFamilyName: draftFontFamily, ligaturesSupport: currentFontSupportsLigatures };

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-150">
      <div className="bg-[#181825] border border-[#313244] w-full max-w-[1240px] shadow-2xl rounded-lg overflow-hidden flex flex-col h-[88vh] min-h-[620px] max-h-[96vh] animate-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div
          data-tauri-drag-region
          className="px-4 py-2.5 border-b border-[#313244]/60 flex items-center justify-between bg-[#11111b]/80 shrink-0 select-none"
        >
          <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
            <span className="text-xs font-semibold text-text tracking-wide">Settings</span>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            className="p-1 rounded hover:bg-[#313244]/50 text-subtext0 hover:text-text transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Modal Body: Zed Split Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Zed Sidebar (Left) */}
          <div className="w-64 bg-[#11111b]/90 border-r border-[#313244]/60 flex flex-col shrink-0 select-none">
            {/* Search Input */}
            <div className="p-3 border-b border-[#313244]/60">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-subtext0 absolute left-2.5 pointer-events-none" />
                <input
                  ref={sidebarSearchInputRef}
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#181825] border border-[#313244] rounded px-2.5 pl-8 pr-7 py-1.5 text-xs text-text placeholder:text-subtext0/60 focus:outline-none focus:border-[#45475a] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-subtext0 hover:text-text cursor-pointer p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Categories Navigation */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {filteredCategories.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-subtext0 italic">
                  No settings matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredCategories.map((cat) => {
                  const isActive = activeTab === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveTab(cat.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded transition-colors cursor-pointer text-left ${
                        isActive
                          ? 'bg-[#313244]/80 text-text font-medium'
                          : 'text-subtext0 hover:text-text hover:bg-[#313244]/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronRight
                          className={`w-2.5 h-2.5 shrink-0 transition-transform duration-150 ${
                            isActive ? 'rotate-90 text-text' : 'text-subtext0/70'
                          }`}
                        />
                        <span className="truncate">{cat.label}</span>
                      </div>
                      {Boolean(cat.unsavedCount && cat.unsavedCount > 0) && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-surface2 text-text border border-surface1 shrink-0">
                          {cat.unsavedCount}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Keyboard Shortcut Hints at Bottom */}
            <div className="p-3 border-t border-[#313244]/60 text-[11px] text-subtext0/80 font-mono flex items-center justify-between select-none">
              <span>Ctrl-Shift-E Focus Navbar</span>
              <span>Esc Close</span>
            </div>
          </div>

          {/* Zed Content Area (Right) */}
          <div className="flex-1 overflow-y-auto p-8 bg-[#181825] flex flex-col">
            {/* Top Scope & Action Row (Zed style) */}
            <div className="flex items-center justify-between mb-4">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#313244]/60 text-subtext1 border border-[#45475a]/50 select-none">
                User
              </span>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-[11px] text-subtext0 hover:text-text transition-colors cursor-pointer hover:underline"
              >
                Reset all to defaults
              </button>
            </div>

            {/* Category Header */}
            <div className="mb-5 pb-3 border-b border-[#313244]/60">
              <h2 className="text-base font-semibold text-text">{currentCategory.title}</h2>
              <p className="text-[11px] text-subtext0 mt-0.5">{currentCategory.description}</p>
            </div>

            {/* TAB: GENERAL */}
            {activeTab === 'general' && (
              <div className="space-y-1">
                <SettingRow
                  title="Inline Git Blame"
                  description={formatShortcutText(
                    'Show commit author, relative time, and summary annotation at the end of the active line in diff view (Alt+Shift+B).'
                  )}
                >
                  <ZedSwitch
                    checked={draftShowInlineBlame}
                    onChange={setDraftShowInlineBlame}
                  />
                </SettingRow>

                <SettingRow
                  title="Stream AI Responses"
                  description="Stream token-by-token completion for real-time responsiveness when generating summaries and reviews."
                >
                  <ZedSwitch
                    checked={draftAiConfig.streamResponse}
                    onChange={(val) =>
                      setDraftAiConfig((prev) => ({ ...prev, streamResponse: val }))
                    }
                  />
                </SettingRow>

                <SettingRow
                  title="AI Code Review Assistance"
                  description="Enable proactive code review suggestions, inline risk detection, and automated MR annotations."
                >
                  <ZedSwitch
                    checked={draftAiConfig.enableCodeReviewAssist}
                    onChange={(val) =>
                      setDraftAiConfig((prev) => ({
                        ...prev,
                        enableCodeReviewAssist: val,
                      }))
                    }
                  />
                </SettingRow>

                <SettingRow
                  title="Accessible Mode"
                  description="Optimize interface contrast, outline focus rings, and enhance keyboard navigation for assistive technologies."
                >
                  <ZedSwitch
                    checked={false}
                    onChange={() => {
                      showToast(
                        'Accessible Mode is currently following system high-contrast profile'
                      );
                    }}
                  />
                </SettingRow>
              </div>
            )}

            {/* TAB: APPEARANCE */}
            {activeTab === 'appearance' && (
              <div className="space-y-1">
                <SettingRow
                  title="Interface Theme"
                  description={
                    draftThemeMode === 'system'
                      ? 'Synchronized with your operating system color scheme'
                      : draftThemeMode === 'dark'
                      ? 'Catppuccin Mocha aesthetic dark theme'
                      : 'Catppuccin Latte clean light theme'
                  }
                >
                  <div className="inline-flex items-center p-0.5 bg-[#11111b] border border-[#313244] gap-0.5 rounded shadow-inner">
                    <button
                      type="button"
                      onClick={() => handleSelectTheme('system')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${
                        draftThemeMode === 'system'
                          ? 'bg-[#313244] text-text font-semibold shadow-xs'
                          : 'text-subtext0 hover:text-text hover:bg-[#313244]/40'
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
                          ? 'bg-[#313244] text-text font-semibold shadow-xs'
                          : 'text-subtext0 hover:text-text hover:bg-[#313244]/40'
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
                          ? 'bg-[#313244] text-text font-semibold shadow-xs'
                          : 'text-subtext0 hover:text-text hover:bg-[#313244]/40'
                      }`}
                      title="Catppuccin Latte light theme"
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>
                  </div>
                </SettingRow>
              </div>
            )}

            {/* TAB: EDITOR & FONTS */}
            {activeTab === 'fonts' && (
              <div className="space-y-4">
                {/* Font Family Row */}
                <SettingRow
                  title="Monospace Font Family"
                  description="Primary typography for code diffs, raw file viewer, and terminal views."
                >
                  <div className="relative w-64" ref={fontDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsFontDropdownOpen(!isFontDropdownOpen)}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded border border-[#313244] bg-[#11111b] hover:bg-[#1e1e2e] text-text text-xs transition-colors cursor-pointer"
                    >
                      <span
                        className="truncate font-semibold"
                        style={{ fontFamily: selectedFontObj.fontFamilyName }}
                      >
                        {selectedFontObj.fontFamilyName}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-subtext0 transition-transform duration-200 shrink-0 ml-2 ${
                          isFontDropdownOpen ? 'rotate-180 text-text' : ''
                        }`}
                      />
                    </button>

                    {isFontDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#181825] border border-[#313244] rounded shadow-2xl z-50 overflow-hidden flex flex-col max-h-72">
                        <div className="p-2 border-b border-[#313244] bg-[#11111b] sticky top-0 z-10 flex items-center gap-2">
                          <Search className="w-3 h-3 text-subtext0 shrink-0 ml-1" />
                          <input
                            ref={fontSearchInputRef}
                            type="text"
                            placeholder="Filter fonts..."
                            value={fontSearchQuery}
                            onChange={(e) => setFontSearchQuery(e.target.value)}
                            className="w-full bg-transparent text-xs text-text placeholder:text-subtext0 focus:outline-none py-0.5"
                          />
                          {fontSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setFontSearchQuery('')}
                              className="p-0.5 text-subtext0 hover:text-text rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="overflow-y-auto divide-y divide-[#313244]/40 p-1">
                          {filteredFonts.length === 0 ? (
                            <div className="px-3 py-4 text-center text-xs text-subtext0 italic">
                              No matching font
                            </div>
                          ) : (
                            filteredFonts.map((font) => {
                              const isSelected =
                                draftFontFamily.toLowerCase() ===
                                font.fontFamilyName.toLowerCase();

                              return (
                                <button
                                  key={font.fontFamilyName}
                                  type="button"
                                  onClick={() => {
                                    setDraftFontFamily(font.fontFamilyName);
                                    setDraftEnableLigatures(font.ligaturesSupport);
                                    setIsFontDropdownOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#313244] text-text font-semibold'
                                      : 'hover:bg-[#1e1e2e] text-subtext1 hover:text-text'
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
                                      className="text-[10px] text-subtext0 truncate opacity-70"
                                      style={{ fontFamily: font.fontFamilyName }}
                                    >
                                      const code = (a != b) =&gt; a &amp;&amp; b;
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {font.ligaturesSupport ? (
                                      <span className="text-[9px] px-1.5 py-0.5 bg-[#11111b] text-subtext0 border border-[#313244] font-mono rounded">
                                        Ligatures
                                      </span>
                                    ) : (
                                      <span className="text-[9px] px-1.5 py-0.5 bg-[#11111b] text-subtext0/70 border border-[#313244] rounded">
                                        Mono
                                      </span>
                                    )}
                                    {isSelected && <Check className="w-3.5 h-3.5 text-text ml-1" />}
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
                <SettingRow
                  title="Editor Font Size"
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
                      className="w-16 px-2.5 py-1.5 bg-[#11111b] border border-[#313244] text-xs text-text focus:outline-none focus:border-[#45475a] font-mono rounded text-center"
                    />
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDraftFontSize((prev) => Math.max(10, prev - 1))}
                        className="px-2 py-1 rounded border border-[#313244] hover:bg-[#313244]/50 text-text text-xs cursor-pointer font-bold"
                        title="Decrease font size"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftFontSize((prev) => Math.min(24, prev + 1))}
                        className="px-2 py-1 rounded border border-[#313244] hover:bg-[#313244]/50 text-text text-xs cursor-pointer font-bold"
                        title="Increase font size"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </SettingRow>

                {/* Font Styling Row */}
                <SettingRow
                  title="Font Weight & Emphasis"
                  description="Apply Bold, Italic, or Underline formatting to diff text."
                >
                  <div className="flex items-center gap-1 bg-[#11111b] p-0.5 rounded border border-[#313244]">
                    <button
                      type="button"
                      onClick={() => setDraftIsBold(!draftIsBold)}
                      className={`flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                        draftIsBold
                          ? 'bg-[#313244] text-text font-bold shadow-xs'
                          : 'text-subtext0 hover:bg-[#313244]/40 hover:text-text'
                      }`}
                      title={formatShortcutText('Bold (Ctrl+B)')}
                    >
                      <Bold className="w-3 h-3" />
                      <span>Bold</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDraftIsItalic(!draftIsItalic)}
                      className={`flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                        draftIsItalic
                          ? 'bg-[#313244] text-text font-bold italic shadow-xs'
                          : 'text-subtext0 hover:bg-[#313244]/40 hover:text-text'
                      }`}
                      title={formatShortcutText('Italic (Ctrl+I)')}
                    >
                      <Italic className="w-3 h-3" />
                      <span>Italic</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDraftIsUnderline(!draftIsUnderline)}
                      className={`flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
                        draftIsUnderline
                          ? 'bg-[#313244] text-text font-bold underline shadow-xs'
                          : 'text-subtext0 hover:bg-[#313244]/40 hover:text-text'
                      }`}
                      title={formatShortcutText('Underline (Ctrl+U)')}
                    >
                      <Underline className="w-3 h-3" />
                      <span>Underline</span>
                    </button>
                  </div>
                </SettingRow>

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
                      step="0.1"
                      value={draftLineSpacing}
                      onChange={(e) => setDraftLineSpacing(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-surface1 appearance-none cursor-pointer accent-[#238636] rounded"
                    />
                    <span className="text-xs font-mono font-bold text-text px-1.5 py-0.5 bg-[#11111b] border border-[#313244] rounded shrink-0">
                      {draftLineSpacing}x
                    </span>
                  </div>
                </SettingRow>

                {/* Ligatures Row */}
                <SettingRow
                  title="Font Ligatures"
                  description={
                    <span className="flex items-center gap-2">
                      <span>Renders coding ligatures such as =&gt;, !==, &lt;=, &gt;=, &amp;&amp;.</span>
                      {!currentFontSupportsLigatures && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-subtext0 bg-[#11111b] px-1.5 py-0.5 rounded border border-[#313244]">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Unsupported by {draftFontFamily}
                        </span>
                      )}
                    </span>
                  }
                >
                  <ZedSwitch
                    checked={draftEnableLigatures && currentFontSupportsLigatures}
                    disabled={!currentFontSupportsLigatures}
                    onChange={(val) => setDraftEnableLigatures(val)}
                  />
                </SettingRow>

                {/* Live Preview Panel */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-text">Code Preview</span>
                    <span className="text-[11px] text-subtext0 font-mono">
                      {draftFontFamily} • {draftFontSize}px • {draftLineSpacing}x
                    </span>
                  </div>

                  <div
                    className="p-4 bg-[#11111b] border border-[#313244] rounded overflow-x-auto select-text shadow-inner"
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
                    <div className="text-subtext0/70 text-[11px] mb-1 font-sans select-none">
                      // Stage0 Code Viewer Ligature Preview
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

            {/* TAB: VERSION CONTROL */}
            {activeTab === 'git' && (
              <div className="animate-in fade-in duration-100">
                <GitBinaryTab
                  draftBinaryId={draftGitBinaryId}
                  draftBinaryPath={draftGitBinaryPath}
                  onSelectBinary={(id, path) => {
                    setDraftGitBinaryId(id);
                    setDraftGitBinaryPath(path);
                  }}
                  committedBinaryId={savedBaseline.gitBinaryId}
                  committedBinaryPath={savedBaseline.gitBinaryPath}
                />
              </div>
            )}

            {/* TAB: GIT CREDENTIALS */}
            {activeTab === 'credentials' && (
              <div className="animate-in fade-in duration-100">
                <GitCredentialsTab />
              </div>
            )}

            {/* TAB: SANDBOX ENGINE */}
            {activeTab === 'sandbox' && (
              <div className="animate-in fade-in duration-100">
                <SandboxTab
                  draftSandboxType={draftSandboxType}
                  onSelectAdapter={setDraftSandboxType}
                  isPendingCommit={draftSandboxType !== savedBaseline.sandboxType}
                />
              </div>
            )}

            {/* TAB: AI & MCP */}
            {activeTab === 'ai' && (
              <div className="animate-in fade-in duration-100">
                <AiMcpTab
                  draftAiConfig={draftAiConfig}
                  onUpdateAiConfig={(partial) =>
                    setDraftAiConfig((prev) => ({ ...prev, ...partial }))
                  }
                  onNavigateToGuardrails={() => setActiveTab('guardrails')}
                />
              </div>
            )}

            {/* TAB: BOT REVIEWERS */}
            {activeTab === 'reviewers' && (
              <div className="animate-in fade-in duration-100">
                <BotReviewersTab />
              </div>
            )}

            {/* TAB: SECURITY GUARDRAILS */}
            {activeTab === 'guardrails' && (
              <div className="animate-in fade-in duration-100">
                <GuardrailsTab />
              </div>
            )}
          </div>
        </div>

        {/* Footer: Reset on left, Cancel, Apply, OK on right */}
        <div className="px-6 py-3 border-t border-[#313244]/60 flex items-center justify-between bg-[#11111b]/80 select-none shrink-0">
          {/* Left: Reset to defaults & Unsaved Indicator */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#313244] hover:bg-[#313244]/50 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer rounded"
              title="Reset all settings to application defaults"
            >
              <RotateCcw className="w-3 h-3" />
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
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-1.5 border border-[#313244] hover:bg-[#313244]/50 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer font-medium rounded"
              title="Close without saving (Esc)"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={!hasUnsavedChanges && !isApplied}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer rounded border ${
                isApplied
                  ? 'bg-surface2 text-text border-surface1'
                  : hasUnsavedChanges
                  ? 'bg-surface1 hover:bg-surface2 text-text border-surface2 shadow-xs'
                  : 'bg-surface0/30 text-subtext0/40 border-surface0/50 cursor-not-allowed'
              }`}
              title="Save changes and keep window open (Ctrl+S)"
            >
              {isApplied ? (
                <>
                  <Check className="w-3 h-3 text-text" />
                  <span>Applied</span>
                </>
              ) : (
                <span>Apply</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleOk}
              className="px-5 py-1.5 bg-[#238636] hover:bg-[#238636]/90 text-white font-semibold text-xs transition-colors cursor-pointer rounded"
              title="Save changes and close window"
            >
              OK
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Reset to Defaults */}
      {showResetConfirm && (
        <div className="fixed inset-x-0 bottom-0 top-8.5 z-[60] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-100">
          <div className="bg-[#181825] border border-[#313244] max-w-md w-full p-5 rounded-lg shadow-2xl space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-[#11111b] border border-[#313244] text-subtext0 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Reset all preferences to default?</h3>
                <p className="text-xs text-subtext0 mt-1 leading-relaxed">
                  This will immediately reset all settings (Theme, Viewer Fonts, Inline Blame, Sandbox Engine, and AI Configuration) to application defaults and commit them.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#313244]/60">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded border border-[#313244] hover:bg-[#313244]/50 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetToDefault}
                className="px-3.5 py-1.5 rounded bg-[#da3633] text-white text-xs font-semibold hover:bg-[#da3633]/90 transition-colors cursor-pointer shadow-xs"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Restart to Apply Git Binary */}
      {showRestartPrompt && (
        <div className="fixed inset-x-0 bottom-0 top-8.5 z-[70] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-100">
          <div className="bg-[#181825] border border-[#313244] max-w-md w-full p-5 rounded-lg shadow-2xl space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded bg-peach/15 border border-peach/30 text-peach shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-text">Restart Required to Apply Git Binary</h3>
                <p className="text-xs text-subtext0 mt-1 leading-relaxed">
                  The active Git binary has been switched to:
                </p>
                <div className="mt-1.5 p-2 rounded bg-[#11111b] border border-[#313244] font-mono text-[11px] text-text break-all">
                  {draftGitBinaryPath}
                </div>
                <p className="text-xs text-subtext0 mt-2 leading-relaxed">
                  A restart of Stage0 is required to apply this Git executable across all background watchers, diff comparisons, and sandbox worktrees cleanly.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#313244]/60">
              <button
                type="button"
                onClick={() => {
                  setShowRestartPrompt(false);
                  setIsPreferencesOpen(false);
                }}
                className="px-3.5 py-1.5 rounded border border-[#313244] hover:bg-[#313244]/50 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
              >
                Restart Later
              </button>
              <button
                type="button"
                onClick={async () => {
                  await restartApp();
                }}
                className="px-4 py-1.5 rounded bg-[#238636] text-white text-xs font-semibold hover:bg-[#238636]/90 transition-colors cursor-pointer shadow-xs"
              >
                Restart Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
