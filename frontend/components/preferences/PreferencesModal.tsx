import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Monitor,
  Moon,
  Sun,
  AlertCircle,
  AlertTriangle,
  Bold,
  Italic,
  Underline,
  Code,
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
  | 'general-settings'
  | 'general-guardrails'
  | 'general-privacy'
  | 'appearance'
  | 'appearance-theme'
  | 'appearance-fonts'
  | 'editor'
  | 'editor-diff'
  | 'ai'
  | 'ai-overview'
  | 'ai-providers'
  | 'ai-mcp'
  | 'ai-reviewers'
  | 'ai-sandbox'
  | 'git'
  | 'git-binary'
  | 'git-credentials'
  | 'fonts'
  | 'credentials'
  | 'sandbox'
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

interface TreeChildItem {
  id: PreferenceTab;
  label: string;
  title: string;
  description: string;
  keywords: string[];
}

interface TreeCategory {
  id: string;
  label: string;
  children: TreeChildItem[];
}

// Tree view hierarchy matching Zed's structure
const SETTINGS_TREE: TreeCategory[] = [
  {
    id: 'general',
    label: 'General',
    children: [
      {
        id: 'general-settings',
        label: 'General Settings',
        title: 'General Settings',
        description: 'Configure inline annotations, streaming, and workspace behaviors.',
        keywords: ['blame', 'stream', 'accessible', 'general', 'notifications'],
      },
      {
        id: 'general-guardrails',
        label: 'Security & Guardrails',
        title: 'Security & Guardrails',
        description: 'Path restrictions, destructive command blocking, and approval thresholds.',
        keywords: ['guardrails', 'security', 'sandbox', 'policy', 'safety', 'destructive', 'permission', 'tokens'],
      },
      {
        id: 'general-privacy',
        label: 'Privacy & Telemetry',
        title: 'Privacy & Telemetry',
        description: 'Zero telemetry policy, isolated working trees, and local secret management.',
        keywords: ['privacy', 'telemetry', 'offline', 'security', 'analytics'],
      },
    ],
  },
  {
    id: 'appearance',
    label: 'Appearance',
    children: [
      {
        id: 'appearance-theme',
        label: 'Theme',
        title: 'Theme & Interface Mode',
        description: 'Choose whether to use the selected light or dark theme or follow your OS appearance.',
        keywords: ['theme', 'dark', 'light', 'mocha', 'latte', 'color', 'mode', 'appearance', 'palette'],
      },
      {
        id: 'appearance-fonts',
        label: 'Buffer Font',
        title: 'Buffer Font & Typography',
        description: 'Font family, font size, weight, line height, and ligature rendering for editor panes.',
        keywords: ['font', 'family', 'size', 'ligatures', 'bold', 'italic', 'underline', 'spacing', 'typography'],
      },
    ],
  },
  {
    id: 'editor',
    label: 'Editor & Diff',
    children: [
      {
        id: 'editor-diff',
        label: 'Diff Viewer',
        title: 'Diff Viewer & Code Navigation',
        description: 'Configure split/unified diff visualization, whitespace sensitivity, and inline blame.',
        keywords: ['diff', 'split', 'unified', 'whitespace', 'viewer', 'blame'],
      },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    children: [
      {
        id: 'ai-overview',
        label: 'General',
        title: 'AI',
        description: 'Whether opening a virtual MR or repository automatically enables AI assistant context.',
        keywords: ['ai', 'overview', 'llm', 'providers', 'mcp', 'agents', 'reviewers', 'skills', 'sandbox'],
      },
      {
        id: 'ai-providers',
        label: 'LLM Providers',
        title: 'LLM Providers',
        description: 'Configure natively-included model providers (OpenAI, Anthropic, DeepSeek, Ollama, etc.).',
        keywords: ['openai', 'anthropic', 'deepseek', 'ollama', 'model', 'api key', 'provider', 'groq'],
      },
      {
        id: 'ai-mcp',
        label: 'MCP Servers',
        title: 'MCP Servers',
        description: 'View, add, configure, and remove Model Context Protocol servers.',
        keywords: ['mcp', 'protocol', 'servers', 'stdio', 'sse', 'tools'],
      },
      {
        id: 'ai-reviewers',
        label: 'External Agents',
        title: 'External Agents & Reviewer Bots',
        description: 'View, add, and remove bots and agents connected for automated pull/virtual MR reviews.',
        keywords: ['agents', 'reviewers', 'bots', 'code review', 'persona'],
      },
      {
        id: 'ai-sandbox',
        label: 'Sandbox',
        title: 'Sandbox & Tool Permissions',
        description: 'Review and change the elevated virtual sandbox permissions (In-Memory, Docker, Host).',
        keywords: ['sandbox', 'docker', 'container', 'in_memory', 'isolation', 'terminal', 'permissions'],
      },
    ],
  },
  {
    id: 'git',
    label: 'Version Control',
    children: [
      {
        id: 'git-binary',
        label: 'Git Executable',
        title: 'Git Executable',
        description: 'Select the Git executable used for repository operations. Saved Git credentials are not currently injected into Git commands.',
        keywords: ['git', 'binary', 'executable', 'path', 'runner'],
      },
      {
        id: 'git-credentials',
        label: 'Git Credentials',
        title: 'Git Credentials & Remotes',
        description: 'Store Git credential metadata and secrets locally. Stage0 does not currently inject saved credentials into Git commands.',
        keywords: ['credentials', 'token', 'pat', 'github', 'gitlab', 'auth'],
      },
    ],
  },
];

// Helper to normalize legacy tab strings
const normalizeTab = (tab?: string): PreferenceTab => {
  if (!tab) return 'ai-overview';
  switch (tab) {
    case 'about':
    case 'general':
      return 'general-settings';
    case 'guardrails':
      return 'general-guardrails';
    case 'appearance':
      return 'appearance-theme';
    case 'fonts':
      return 'appearance-fonts';
    case 'editor':
      return 'editor-diff';
    case 'ai':
      return 'ai-overview';
    case 'mcp':
      return 'ai-mcp';
    case 'reviewers':
      return 'ai-reviewers';
    case 'sandbox':
      return 'ai-sandbox';
    case 'git':
      return 'git-binary';
    case 'credentials':
      return 'git-credentials';
    default:
      return tab as PreferenceTab;
  }
};

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
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${disabled
          ? 'opacity-40 cursor-not-allowed bg-[#313244]'
          : checked
            ? 'bg-[#cba6f7]'
            : 'bg-[#313244]'
        }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-[#11111b] shadow-xs ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4.5 bg-[#11111b]' : 'translate-x-0.5 bg-[#a6adc8]'
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
      className={`py-3 flex items-center justify-between gap-6 ${borderBottom ? 'border-b border-[#313244]/40' : ''
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
    resetViewerFontSettings,
    showInlineBlame: storedShowInlineBlame,
    setShowInlineBlame: storeSetShowInlineBlame,
  } = usePreferencesStore();

  const { themeMode: storedThemeMode, setThemeMode: storeSetThemeMode } = useThemeStore();
  const { activeSandboxType: storedSandboxType, setActiveSandbox: storeSetActiveSandbox, showToast } = useGitStore();
  const { aiConfig: storedAiConfig, updateAiConfig: storeUpdateAiConfig } = useAiMcpStore();
  const {
    activeBinaryId: storedGitBinaryId,
    activeBinaryPath: storedGitBinaryPath,
    setActiveBinary: storeSetActiveBinary,
    fetchActiveBinary,
  } = useGitBinaryStore();



  const [activeTab, setActiveTab] = useState<PreferenceTab | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded parent categories in tree (all collapsed by default)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Draft States
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

      fetchActiveBinary().then((res) => {
        setDraftGitBinaryId(res.id);
        setDraftGitBinaryPath(res.path);
        setSavedBaseline((prev) => ({
          ...prev,
          gitBinaryId: res.id,
          gitBinaryPath: res.path,
        }));
      });

      setActiveTab(null);
      setExpandedGroups({});
      setSearchQuery('');
      setIsApplied(false);
      setShowResetConfirm(false);
      setShowRestartPrompt(false);
    } else {
      setDraftAiConfig((current) => ({ ...current, apiKey: '' }));
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
    fetchActiveBinary,
  ]);

  // Unsaved count calculation
  const totalUnsaved = useMemo(() => {
    let count = 0;
    if (draftShowInlineBlame !== savedBaseline.showInlineBlame) count++;
    if (draftAiConfig.streamResponse !== savedBaseline.aiConfig.streamResponse) count++;
    if (draftAiConfig.enableCodeReviewAssist !== savedBaseline.aiConfig.enableCodeReviewAssist) count++;
    if (draftThemeMode !== savedBaseline.themeMode) count++;
    if (draftFontFamily !== savedBaseline.fontFamily) count++;
    if (draftFontSize !== savedBaseline.fontSize) count++;
    if (draftIsBold !== savedBaseline.isBold) count++;
    if (draftIsItalic !== savedBaseline.isItalic) count++;
    if (draftIsUnderline !== savedBaseline.isUnderline) count++;
    if (draftLineSpacing !== savedBaseline.lineSpacing) count++;
    if (draftEnableLigatures !== savedBaseline.enableLigatures) count++;
    if (draftSandboxType !== savedBaseline.sandboxType) count++;
    if (draftGitBinaryId !== savedBaseline.gitBinaryId) count++;
    return count;
  }, [
    draftShowInlineBlame,
    draftAiConfig,
    draftThemeMode,
    draftFontFamily,
    draftFontSize,
    draftIsBold,
    draftIsItalic,
    draftIsUnderline,
    draftLineSpacing,
    draftEnableLigatures,
    draftSandboxType,
    draftGitBinaryId,
    savedBaseline,
  ]);

  const hasUnsavedChanges = totalUnsaved > 0;

  // Filter tree categories based on search
  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SETTINGS_TREE;

    return SETTINGS_TREE.map((group) => {
      const groupMatches = group.label.toLowerCase().includes(q);
      const matchingChildren = group.children.filter((child) => {
        return (
          groupMatches ||
          child.label.toLowerCase().includes(q) ||
          child.title.toLowerCase().includes(q) ||
          child.description.toLowerCase().includes(q) ||
          child.keywords.some((k) => k.toLowerCase().includes(q))
        );
      });

      return {
        ...group,
        children: matchingChildren,
      };
    }).filter((group) => group.children.length > 0);
  }, [searchQuery]);

  // Auto-expand groups when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const allOpen: Record<string, boolean> = {};
      filteredTree.forEach((g) => {
        allOpen[g.id] = true;
      });
      setExpandedGroups(allOpen);
    }
  }, [searchQuery, filteredTree]);

  // Current active child metadata
  const currentChildItem = useMemo(() => {
    if (!activeTab) return null;
    const norm = normalizeTab(activeTab);
    for (const group of SETTINGS_TREE) {
      for (const child of group.children) {
        if (child.id === norm) return child;
      }
    }
    return null;
  }, [activeTab]);

  // Theme preview handlers
  const handleSelectTheme = (mode: ThemeMode) => {
    setDraftThemeMode(mode);
    const resolved = resolveTheme(mode);
    applyThemeToDocument(resolved);
  };

  // Font Selection State
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const fontSearchInputRef = useRef<HTMLInputElement>(null);

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

  // Settings.json representation


  // Commit changes
  const handleApply = async () => {
    storeSetThemeMode(draftThemeMode);
    const resolvedTheme = resolveTheme(draftThemeMode);
    applyThemeToDocument(resolvedTheme);

    const fontSettings: ViewerFontSettings = {
      fontFamily: draftFontFamily,
      fontSize: draftFontSize,
      isBold: draftIsBold,
      isItalic: draftIsItalic,
      isUnderline: draftIsUnderline,
      lineSpacing: draftLineSpacing,
      enableLigatures: draftEnableLigatures,
    };
    updateViewerFontSettings(fontSettings);
    applyViewerFontToDocument(fontSettings);

    storeSetShowInlineBlame(draftShowInlineBlame);
    await storeSetActiveSandbox(draftSandboxType);
    const safeDraftAiConfig = { ...draftAiConfig, apiKey: '' };
    storeUpdateAiConfig(draftAiConfig);
    setDraftAiConfig(safeDraftAiConfig);

    let needsRestart = false;
    if (draftGitBinaryId !== savedBaseline.gitBinaryId) {
      await storeSetActiveBinary(draftGitBinaryId, draftGitBinaryPath);
      needsRestart = true;
    }

    setSavedBaseline({
      themeMode: draftThemeMode,
      fontFamily: draftFontFamily,
      fontSize: draftFontSize,
      isBold: draftIsBold,
      isItalic: draftIsItalic,
      isUnderline: draftIsUnderline,
      lineSpacing: draftLineSpacing,
      enableLigatures: draftEnableLigatures,
      showInlineBlame: draftShowInlineBlame,
      sandboxType: draftSandboxType,
      aiConfig: safeDraftAiConfig,
      gitBinaryId: draftGitBinaryId,
      gitBinaryPath: draftGitBinaryPath,
    });

    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 2000);
    showToast('Preferences applied successfully');

    if (needsRestart) {
      setShowRestartPrompt(true);
    }
  };

  const handleOk = async () => {
    if (hasUnsavedChanges) {
      await handleApply();
    }
    setIsPreferencesOpen(false);
  };

  const handleCancel = () => {
    const resolvedTheme = resolveTheme(savedBaseline.themeMode);
    applyThemeToDocument(resolvedTheme);

    const fontSettings: ViewerFontSettings = {
      fontFamily: savedBaseline.fontFamily,
      fontSize: savedBaseline.fontSize,
      isBold: savedBaseline.isBold,
      isItalic: savedBaseline.isItalic,
      isUnderline: savedBaseline.isUnderline,
      lineSpacing: savedBaseline.lineSpacing,
      enableLigatures: savedBaseline.enableLigatures,
    };
    applyViewerFontToDocument(fontSettings);

    setIsPreferencesOpen(false);
  };

  const handleResetDefaults = () => {
    setDraftThemeMode('system');
    applyThemeToDocument(resolveTheme('system'));

    resetViewerFontSettings();
    applyViewerFontToDocument(DEFAULT_VIEWER_FONT_SETTINGS);

    setDraftShowInlineBlame(true);
    setDraftSandboxType('in_memory');
    setDraftAiConfig({ ...DEFAULT_AI_CONFIG });

    setShowResetConfirm(false);
    showToast('Reset all draft settings to defaults (click Apply to save)');
  };

  // Keyboard navigation
  const sidebarSearchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isPreferencesOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFontDropdownOpen) {
          setIsFontDropdownOpen(false);
          return;
        }
        if (showResetConfirm) {
          setShowResetConfirm(false);
          return;
        }
        handleCancel();
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        sidebarSearchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreferencesOpen, isFontDropdownOpen, showResetConfirm, handleCancel]);

  if (!isPreferencesOpen) return null;

  const currentTabId = activeTab ? normalizeTab(activeTab) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div
        className="relative w-full max-w-4xl h-[680px] max-h-[90vh] bg-[#181825] border border-[#313244] shadow-2xl flex flex-col overflow-hidden text-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Window Bar */}
        <div className="h-9 px-4 bg-[#11111b] border-b border-[#313244]/80 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-tight text-text">Preferences</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 rounded text-subtext0 hover:text-text hover:bg-[#313244]/50 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body (Tree Sidebar + Content Pane) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Collapsible Tree Navigation */}
          <div className="w-64 bg-[#11111b] border-r border-[#313244]/80 flex flex-col shrink-0 overflow-hidden">
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

            {/* Tree Items List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredTree.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-subtext0 italic">
                  No settings matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredTree.map((group) => {
                  const isExpanded = expandedGroups[group.id] ?? false;
                  const hasActiveChild = group.children.some((c) => c.id === currentTabId);

                  return (
                    <div key={group.id} className="space-y-0.5">
                      {/* Category Parent Header */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded transition-colors cursor-pointer select-none text-left group ${hasActiveChild ? 'text-text font-semibold' : 'text-subtext1 hover:text-text hover:bg-[#313244]/20'
                          }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronRight
                            className={`w-3 h-3 text-subtext0 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-90 text-text' : 'group-hover:text-text'
                              }`}
                          />
                          <span className="truncate">{group.label}</span>
                        </div>
                      </button>

                      {/* Collapsible Children */}
                      {isExpanded && (
                        <div className="space-y-0.5 pl-3">
                          {group.children.map((child) => {
                            const isActive = currentTabId === child.id;
                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => setActiveTab(child.id)}
                                className={`w-full flex items-center justify-between pl-5 pr-2 py-1.5 text-xs rounded transition-colors cursor-pointer text-left ${isActive
                                    ? 'bg-[#313244]/90 text-text font-medium shadow-xs'
                                    : 'text-subtext0 hover:text-text hover:bg-[#313244]/30'
                                  }`}
                              >
                                <span className="truncate">{child.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Settings Content Area */}
          <div className="flex-1 overflow-y-auto p-8 bg-[#181825] flex flex-col">

            {/* Placeholder when no item selected */}
            {!currentChildItem && (
              <div className="flex-1 flex flex-col items-center justify-center text-center select-none">
                <div className="w-12 h-12 mb-4 flex items-center justify-center bg-[#313244]/40 border border-[#313244]/60">
                  <Code className="w-5 h-5 text-subtext0" />
                </div>
                <p className="text-sm text-subtext1 font-medium">Select a setting</p>
                <p className="text-xs text-subtext0 mt-1 max-w-[260px] leading-relaxed">Choose a category from the sidebar to view and modify its settings.</p>
              </div>
            )}

            {/* Category Header */}
            {currentChildItem && (
              <div className="mb-5 pb-3 border-b border-[#313244]/60">
                <h2 className="text-base font-semibold text-text">{currentChildItem.title}</h2>
                <p className="text-[11px] text-subtext0 mt-0.5">{currentChildItem.description}</p>
              </div>
            )}


            {/* VIEW: GENERAL SETTINGS */}
            {currentTabId === 'general-settings' && (
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

            {/* VIEW: SECURITY GUARDRAILS */}
            {currentTabId === 'general-guardrails' && (
              <div className="animate-in fade-in duration-100">
                <GuardrailsTab />
              </div>
            )}

            {/* VIEW: PRIVACY & TELEMETRY */}
            {currentTabId === 'general-privacy' && (
              <div className="space-y-4">
                <SettingRow
                  title="Telemetry & Diagnostics"
                  description="Stage0 enforces a 100% Zero-Telemetry policy. No metrics, usage events, or file contents are ever transmitted to external telemetry servers."
                >
                  <span className="px-2.5 py-1 rounded text-xs bg-emerald-950 text-emerald-300 font-mono border border-emerald-800">
                    Disabled (Zero Telemetry)
                  </span>
                </SettingRow>

                <SettingRow
                  title="Local Secret Management"
                  description="API keys and Git credential secrets are stored in the operating system credential store; metadata is kept locally by Stage0. Secrets are not injected into AI or Git operations."
                >
                  <span className="px-2.5 py-1 rounded text-xs bg-surface1 text-text font-mono border border-surface2">
                    OS Credential Store
                  </span>
                </SettingRow>

                <SettingRow
                  title="Isolated Virtual Tree"
                  description="Diff and conflict checks do not check out branches or modify the working tree or index. Git may write tree or blob objects to the repository object database."
                >
                  <span className="px-2.5 py-1 rounded text-xs bg-surface1 text-text font-mono border border-surface2">
                    100% In-Memory Sandbox
                  </span>
                </SettingRow>
              </div>
            )}

            {/* VIEW: THEME */}
            {currentTabId === 'appearance-theme' && (
              <div className="space-y-1">
                <SettingRow
                  title="Theme Mode"
                  description="Choose whether to use the selected light or dark theme or to follow your OS appearance configuration."
                >
                  <div className="inline-flex items-center p-0.5 bg-[#11111b] border border-[#313244] gap-0.5 rounded shadow-inner">
                    <button
                      type="button"
                      onClick={() => handleSelectTheme('system')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${draftThemeMode === 'system'
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
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${draftThemeMode === 'dark'
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
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer ${draftThemeMode === 'light'
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

                <SettingRow
                  title="Dark Palette"
                  description="Color theme applied when theme mode is set to dark or follows dark OS scheme."
                >
                  <span className="px-3 py-1.5 rounded bg-[#11111b] border border-[#313244] text-xs font-mono text-text">
                    Catppuccin Mocha
                  </span>
                </SettingRow>

                <SettingRow
                  title="Light Palette"
                  description="Color theme applied when theme mode is set to light."
                >
                  <span className="px-3 py-1.5 rounded bg-[#11111b] border border-[#313244] text-xs font-mono text-text">
                    Catppuccin Latte
                  </span>
                </SettingRow>
              </div>
            )}

            {/* VIEW: FONTS */}
            {currentTabId === 'appearance-fonts' && (
              <div className="space-y-1">
                {/* Font Family Row */}
                <SettingRow
                  title="Font Family"
                  description="Monospace font family used across diff viewers, commit logs, and terminal panels."
                >
                  <div className="relative w-64">
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
                        className={`w-3.5 h-3.5 text-subtext0 transition-transform duration-200 shrink-0 ml-2 ${isFontDropdownOpen ? 'rotate-180 text-text' : ''
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
                                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer ${isSelected
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
                      className={`flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${draftIsBold
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
                      className={`flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${draftIsItalic
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
                      className={`flex items-center gap-1 px-3 py-1 rounded text-xs transition-colors cursor-pointer ${draftIsUnderline
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
                      step="0.05"
                      value={draftLineSpacing}
                      onChange={(e) => setDraftLineSpacing(parseFloat(e.target.value))}
                      className="w-full accent-[#cba6f7] cursor-pointer"
                    />
                    <span className="text-xs font-mono text-text shrink-0 w-10 text-right">
                      {draftLineSpacing.toFixed(2)}x
                    </span>
                  </div>
                </SettingRow>

                {/* Ligatures Row */}
                <SettingRow
                  title="Programming Ligatures"
                  description="Render modern programming ligatures (e.g. !=, ===, =&gt;) if supported by the active font."
                >
                  <ZedSwitch
                    checked={draftEnableLigatures}
                    disabled={!checkFontLigaturesSupport(draftFontFamily)}
                    onChange={setDraftEnableLigatures}
                  />
                </SettingRow>
              </div>
            )}

            {/* VIEW: DIFF VIEWER */}
            {currentTabId === 'editor-diff' && (
              <div className="space-y-1">
                <SettingRow
                  title="Inline Blame Annotations"
                  description="Show commit author, relative time, and summary annotation at the end of the active line in diff view."
                >
                  <ZedSwitch
                    checked={draftShowInlineBlame}
                    onChange={setDraftShowInlineBlame}
                  />
                </SettingRow>

                <SettingRow
                  title="Diff View Mode"
                  description="Choose side-by-side split view or unified inline diff representation."
                >
                  <span className="px-3 py-1.5 rounded bg-[#11111b] border border-[#313244] text-xs font-mono text-text">
                    Split / Unified Toggleable
                  </span>
                </SettingRow>
              </div>
            )}

            {/* VIEW: AI OVERVIEW (Clean Zed inspired layout - Screenshot 2) */}
            {currentTabId === 'ai-overview' && (
              <div className="space-y-3">
                <SettingRow
                  title="LLM Providers"
                  description="Configure natively-included model providers."
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai-providers')}
                    className="px-3 py-1.5 rounded bg-[#313244]/60 hover:bg-[#313244] border border-[#45475a]/40 hover:border-[#585b70] text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
                  >
                    <span>Configure</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </SettingRow>

                <SettingRow
                  title="External Agents"
                  description="View, add, and remove agents connected through the Agent Client Protocol."
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai-reviewers')}
                    className="px-3 py-1.5 rounded bg-[#313244]/60 hover:bg-[#313244] border border-[#45475a]/40 hover:border-[#585b70] text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
                  >
                    <span>Configure</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </SettingRow>

                <SettingRow
                  title="MCP Servers"
                  description="View, add, configure, and remove Model Context Protocol servers."
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai-mcp')}
                    className="px-3 py-1.5 rounded bg-[#313244]/60 hover:bg-[#313244] border border-[#45475a]/40 hover:border-[#585b70] text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
                  >
                    <span>Configure</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </SettingRow>

                {/* Subheader: Agent Configuration */}
                <div className="pt-4 pb-1">
                  <div className="text-xs font-semibold text-subtext1">Agent Configuration</div>
                </div>

                <SettingRow
                  title="Skills"
                  description="View and manage agent skills installed globally or in project worktrees."
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai-mcp')}
                    className="px-3 py-1.5 rounded bg-[#313244]/60 hover:bg-[#313244] border border-[#45475a]/40 hover:border-[#585b70] text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
                  >
                    <span>Configure</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </SettingRow>

                <SettingRow
                  title="Sandbox"
                  description="Review and change the elevated terminal sandbox permissions that are always allowed without prompting."
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('ai-sandbox')}
                    className="px-3 py-1.5 rounded bg-[#313244]/60 hover:bg-[#313244] border border-[#45475a]/40 hover:border-[#585b70] text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
                  >
                    <span>Configure</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </SettingRow>

                <SettingRow
                  title="Tool Permissions"
                  description="Set up regex patterns to auto-allow, auto-deny, or always request confirmation, for specific tool inputs."
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('general-guardrails')}
                    className="px-3 py-1.5 rounded bg-[#313244]/60 hover:bg-[#313244] border border-[#45475a]/40 hover:border-[#585b70] text-xs text-text flex items-center gap-1.5 transition-colors cursor-pointer font-medium"
                  >
                    <span>Configure</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </SettingRow>

                <SettingRow
                  title="Single File Review"
                  description="When enabled, agent edits will also be displayed in single-file buffers for review."
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
                  title="Stream AI Responses"
                  description="Stream token-by-token completion for real-time responsiveness when generating summaries."
                >
                  <ZedSwitch
                    checked={draftAiConfig.streamResponse}
                    onChange={(val) =>
                      setDraftAiConfig((prev) => ({ ...prev, streamResponse: val }))
                    }
                  />
                </SettingRow>
              </div>
            )}

            {/* VIEW: LLM PROVIDERS */}
            {currentTabId === 'ai-providers' && (
              <div className="animate-in fade-in duration-100">
                <AiMcpTab
                  draftAiConfig={draftAiConfig}
                  onUpdateAiConfig={(partial) =>
                    setDraftAiConfig((prev) => ({ ...prev, ...partial }))
                  }
                  activeView="providers"
                  onBackToOverview={() => setActiveTab('ai-overview')}
                />
              </div>
            )}

            {/* VIEW: MCP SERVERS */}
            {currentTabId === 'ai-mcp' && (
              <div className="animate-in fade-in duration-100">
                <AiMcpTab
                  draftAiConfig={draftAiConfig}
                  onUpdateAiConfig={(partial) =>
                    setDraftAiConfig((prev) => ({ ...prev, ...partial }))
                  }
                  activeView="mcp"
                  onBackToOverview={() => setActiveTab('ai-overview')}
                />
              </div>
            )}

            {/* VIEW: EXTERNAL AGENTS / BOT REVIEWERS */}
            {currentTabId === 'ai-reviewers' && (
              <div className="animate-in fade-in duration-100 space-y-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('ai-overview')}
                  className="inline-flex items-center gap-1.5 text-xs text-subtext0 hover:text-text transition-colors cursor-pointer group"
                >
                  <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  <span>Back to AI overview</span>
                </button>
                <BotReviewersTab />
              </div>
            )}

            {/* VIEW: SANDBOX */}
            {currentTabId === 'ai-sandbox' && (
              <div className="animate-in fade-in duration-100 space-y-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('ai-overview')}
                  className="inline-flex items-center gap-1.5 text-xs text-subtext0 hover:text-text transition-colors cursor-pointer group"
                >
                  <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  <span>Back to AI overview</span>
                </button>
                <SandboxTab
                  draftSandboxType={draftSandboxType}
                  onSelectAdapter={setDraftSandboxType}
                />
              </div>
            )}

            {/* VIEW: GIT EXECUTABLE */}
            {currentTabId === 'git-binary' && (
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

            {/* VIEW: GIT CREDENTIALS */}
            {currentTabId === 'git-credentials' && (
              <div className="animate-in fade-in duration-100">
                <GitCredentialsTab />
              </div>
            )}
          </div>
        </div>

        {/* Footer: Reset on left, Cancel, Apply, OK on right */}
        <div className="px-6 py-3 border-t border-[#313244]/60 flex items-center justify-between bg-[#11111b]/80 select-none shrink-0">
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
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer rounded border ${isApplied
                  ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                  : hasUnsavedChanges
                    ? 'bg-[#313244] hover:bg-[#45475a] border-[#45475a] text-text shadow-xs'
                    : 'bg-transparent border-transparent text-subtext0 opacity-40 cursor-not-allowed'
                }`}
            >
              {isApplied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Applied</span>
                </>
              ) : (
                <span>Apply</span>
              )}
            </button>

            <button
              type="button"
              onClick={handleOk}
              className="px-4 py-1.5 bg-[#313244] hover:bg-[#45475a] border border-[#45475a] text-text text-xs font-semibold transition-colors cursor-pointer rounded shadow-xs"
            >
              OK
            </button>
          </div>
        </div>
      </div>



      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div
            className="w-full max-w-md bg-[#181825] border border-[#313244] rounded-xl shadow-2xl p-5 flex flex-col gap-3 text-text"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-text">
              <AlertCircle className="w-5 h-5 text-subtext0 shrink-0" />
              <h3 className="text-sm font-bold">Reset All Preferences?</h3>
            </div>
            <p className="text-xs text-subtext0 leading-relaxed">
              This will restore all theme, font typography, inline blame, and AI configurations
              back to default values.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 text-xs text-subtext0 hover:text-text hover:bg-[#313244]/50 border border-[#313244] rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-3.5 py-1.5 text-xs bg-[#313244] hover:bg-[#45475a] text-text border border-[#45475a] font-semibold rounded transition-colors cursor-pointer"
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restart Prompt for Git Binary */}
      {showRestartPrompt && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div
            className="w-full max-w-md bg-[#181825] border border-[#313244] rounded-xl shadow-2xl p-5 flex flex-col gap-3 text-text"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-text">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <h3 className="text-sm font-bold">Restart Required</h3>
            </div>
            <p className="text-xs text-subtext0 leading-relaxed">
              The Git executable binary was changed. Please restart the Stage0 application to apply
              the new Git runtime across all sandboxes and active repositories.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRestartPrompt(false)}
                className="px-4 py-1.5 text-xs bg-[#313244] hover:bg-[#45475a] text-text border border-[#45475a] font-semibold rounded transition-colors cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
