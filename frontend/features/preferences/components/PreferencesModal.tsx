import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePreferencesStore, applyViewerFontToDocument, DEFAULT_VIEWER_FONT_SETTINGS } from '../store/usePreferencesStore';
import { type ViewerFontSettings } from '../types/ViewerFontSettings';
import { useThemeStore, resolveTheme, applyThemeToDocument } from '../../../core/store/useThemeStore';
import { type ThemeMode } from '../../../core/types/ThemeMode';
import { GitCredentialsTab } from '../../credentials/components/GitCredentialsTab';
import { AiMcpTab } from '../../ai/components/AiMcpTab';
import { BotReviewersTab } from '../../ai/components/BotReviewersTab';
import { ExternalAgentsTab } from '../../ai/components/ExternalAgentsTab';
import { SandboxTab } from '../../ai/components/SandboxTab';
import { GitBinaryTab } from '../../git/components/GitBinaryTab';
import { GuardrailsTab } from '../../ai/components/GuardrailsTab';
import { NotificationsTab } from '../../notifications/components/NotificationsTab';
import { useGitStore } from '../../git/store/useGitStore';
import { createAiPreferencesDraft } from '../../ai/store/createAiPreferencesDraft';
import { captureAiPreferences, commitAiPreferences } from '../../ai/services/commitAiPreferences';
import { aiPreferencesChangeCount } from '../../ai/utils/aiPreferencesSnapshot';
import { DEFAULT_MCP_SERVERS } from '../../ai/constants/aiPresets';
import { DEFAULT_GUARDRAIL_POLICY } from '../../ai/types/guardrails';
import { DEFAULT_BOT_REVIEWERS } from '../../ai/constants/botPresets';
import { useGitBinaryStore } from '../../git/store/useGitBinaryStore';
import { DEFAULT_AI_CONFIG } from '../../ai/constants/aiPresets';
import { type AiConfig } from '../../ai/types/AiConfig';
import { type SandboxType } from '../../git/types/SandboxType';
import type { PreferenceTab } from '../types/PreferenceTab';
import type { PreferencesBaseline } from '../types/PreferencesBaseline';
import { PreferencesJsonEditor } from './PreferencesJsonEditor';
import { SETTINGS_TREE } from '../constants/settingsTree';
import { PreferencesGeneralTab } from './tabs/PreferencesGeneralTab';
import { PreferencesThemeTab } from './tabs/PreferencesThemeTab';
import { PreferencesFontTab } from './tabs/PreferencesFontTab';
import { PreferencesDiffTab } from './tabs/PreferencesDiffTab';
import { PreferencesAiOverviewTab } from './tabs/PreferencesAiOverviewTab';
import { PreferencesNavTree } from './PreferencesNavTree';
import { PreferencesTabHeader } from './PreferencesTabHeader';
import { PreferencesAiDisclaimer } from './PreferencesAiDisclaimer';
import { PreferencesRestartModal } from './PreferencesRestartModal';
import { PreferencesResetModal } from './PreferencesResetModal';
import { PreferencesModalTopBar } from './PreferencesModalTopBar';
import { PreferencesModalFooter } from './PreferencesModalFooter';
import { PreferencesBackButton } from './PreferencesBackButton';
import { filterSettingsTree } from '../utils/filterSettingsTree';
import { countUnsavedPreferences } from '../utils/countUnsavedPreferences';
import { findSettingChildItem } from '../utils/findSettingChildItem';

// Helper to normalize legacy tab strings
const normalizeTab = (tab?: string): PreferenceTab => {
  if (!tab) return 'ai-overview';
  switch (tab) {
    case 'about':
    case 'general':
      return 'general-settings';
    case 'guardrails':
      return 'ai-guardrails';
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
    case 'notifications':
    case 'notifications-settings':
      return 'notifications-settings';
    default:
      return SETTINGS_TREE.some((category) => category.children.some((child) => child.id === tab))
        ? tab as PreferenceTab
        : 'ai-overview';
  }
};

export const PreferencesModal: React.FC = () => {
  const {
    isPreferencesOpen,
    setIsPreferencesOpen,
    initialPreferencesTab,
    setInitialPreferencesTab,
    fontFamily: storedFontFamily,
    fontSize: storedFontSize,
    isBold: storedIsBold,
    isItalic: storedIsItalic,
    isUnderline: storedIsUnderline,
    lineSpacing: storedLineSpacing,
    enableLigatures: storedEnableLigatures,
    showInlineBlame: storedShowInlineBlame,
  } = usePreferencesStore();

  const { themeMode: storedThemeMode } = useThemeStore();
  const { activeSandboxType: storedSandboxType, showToast } = useGitStore();
  const [aiDraftStore] = useState(() => createAiPreferencesDraft(captureAiPreferences()));
  const aiDraft = aiDraftStore();
  const [aiBaseline, setAiBaseline] = useState(captureAiPreferences);
  const draftAiConfig = aiDraft.aiConfig;
  const storedAiConfig = aiBaseline.aiConfig;
  const setDraftAiConfig = (next: AiConfig | ((previous: AiConfig) => AiConfig)) =>
    aiDraft.updateAiConfig(typeof next === 'function' ? next(aiDraftStore.getState().aiConfig) : next);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const applyingRef = useRef(false);
  const {
    activeBinaryId: storedGitBinaryId,
    activeBinaryPath: storedGitBinaryPath,
    fetchActiveBinary,
  } = useGitBinaryStore();

  const [activeTab, setActiveTab] = useState<PreferenceTab | null>(null);
  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Draft States
  const [draftThemeMode, setDraftThemeMode] = useState<ThemeMode>(storedThemeMode);
  const [draftThemeId, setDraftThemeId] = useState('catppuccin-mocha');
  const [draftFontFamily, setDraftFontFamily] = useState(storedFontFamily);
  const [draftFontSize, setDraftFontSize] = useState(storedFontSize);
  const [draftIsBold, setDraftIsBold] = useState(storedIsBold);
  const [draftIsItalic, setDraftIsItalic] = useState(storedIsItalic);
  const [draftIsUnderline, setDraftIsUnderline] = useState(storedIsUnderline);
  const [draftLineSpacing, setDraftLineSpacing] = useState(storedLineSpacing);
  const [draftEnableLigatures, setDraftEnableLigatures] = useState(storedEnableLigatures);
  const [draftDiffViewMode, setDraftDiffViewMode] = useState<'split' | 'unified'>('split');
  const [draftIgnoreWhitespace, setDraftIgnoreWhitespace] = useState(false);
  const [draftWordWrap, setDraftWordWrap] = useState(false);
  const [draftShowInlineBlame, setDraftShowInlineBlame] = useState(storedShowInlineBlame);
  const [draftSandboxType, setDraftSandboxType] = useState<SandboxType>(storedSandboxType);
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

  const wasOpenRef = useRef(false);

  // Synchronize draft states and baseline whenever modal is opened
  useEffect(() => {
    if (isPreferencesOpen) {
      if (!wasOpenRef.current) {
        wasOpenRef.current = true;
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
        const snapshot = captureAiPreferences();
        aiDraftStore.getState().replace(snapshot);
        setAiBaseline(snapshot);
        setApplyError(null);
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

        setSearchQuery('');
        setIsApplied(false);
        setShowResetConfirm(false);
        setShowRestartPrompt(false);
      }
    } else {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        setActiveTab(null);
        setExpandedGroups({});
        aiDraftStore.getState().replace(captureAiPreferences());
      }
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

  // Navigate to initial target tab whenever initialPreferencesTab is requested
  useEffect(() => {
    if (isPreferencesOpen && initialPreferencesTab) {
      const target = normalizeTab(initialPreferencesTab);
      setActiveTab(target);
      const openGroups: Record<string, boolean> = {};
      for (const group of SETTINGS_TREE) {
        if (group.children.some((c) => c.id === target)) {
          openGroups[group.id] = true;
          break;
        }
      }
      setExpandedGroups((prev) => ({ ...prev, ...openGroups }));
      setInitialPreferencesTab(null);
    }
  }, [isPreferencesOpen, initialPreferencesTab, setInitialPreferencesTab]);

  // Unsaved count calculation
  const totalUnsaved = useMemo(() => {
    return countUnsavedPreferences(
      {
        showInlineBlame: draftShowInlineBlame,
        themeMode: draftThemeMode,
        fontFamily: draftFontFamily,
        fontSize: draftFontSize,
        isBold: draftIsBold,
        isItalic: draftIsItalic,
        isUnderline: draftIsUnderline,
        lineSpacing: draftLineSpacing,
        enableLigatures: draftEnableLigatures,
        sandboxType: draftSandboxType,
        gitBinaryId: draftGitBinaryId,
      },
      savedBaseline,
      aiPreferencesChangeCount(aiDraft, aiBaseline)
    );
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
    aiDraft,
    aiBaseline,
  ]);

  const hasUnsavedChanges = totalUnsaved > 0;
  const canCommitPreferences = hasUnsavedChanges && !isApplying;
  useEffect(() => { if (hasUnsavedChanges) setIsApplied(false); }, [hasUnsavedChanges, aiDraft]);

  // Filter tree categories based on search
  const filteredTree = useMemo(() => filterSettingsTree(searchQuery), [searchQuery]);

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
    return findSettingChildItem(activeTab ? normalizeTab(activeTab) : null);
  }, [activeTab]);

  // Commit changes
  const handleApply = async () => {
    if (applyingRef.current) return false;
    applyingRef.current = true;
    setIsApplying(true);
    setApplyError(null);
    try {
      const fontSettings: ViewerFontSettings = {
        fontFamily: draftFontFamily,
        fontSize: draftFontSize,
        isBold: draftIsBold,
        isItalic: draftIsItalic,
        isUnderline: draftIsUnderline,
        lineSpacing: draftLineSpacing,
        enableLigatures: draftEnableLigatures,
      };
      const additionalPreferences: Record<string, unknown> = {};
      const appearancePatch: Record<string, unknown> = {};
      if (draftThemeMode !== savedBaseline.themeMode) appearancePatch.themeMode = draftThemeMode;
      const fontChanged = (Object.keys(fontSettings) as Array<keyof ViewerFontSettings>)
        .some((key) => fontSettings[key] !== savedBaseline[key]);
      if (fontChanged) appearancePatch.viewerFont = fontSettings;
      if (Object.keys(appearancePatch).length) additionalPreferences.appearance = appearancePatch;
      if (draftShowInlineBlame !== savedBaseline.showInlineBlame) {
        additionalPreferences.general = { showInlineBlame: draftShowInlineBlame };
      }
      if (draftSandboxType !== savedBaseline.sandboxType) additionalPreferences.sandbox = { type: draftSandboxType };
      if (draftGitBinaryId !== savedBaseline.gitBinaryId || draftGitBinaryPath !== savedBaseline.gitBinaryPath) {
        additionalPreferences.git = { binaryId: draftGitBinaryId, binaryPath: draftGitBinaryPath };
      }
      const committedAi = await commitAiPreferences(aiDraftStore.getState(), aiBaseline, additionalPreferences);
      aiDraftStore.getState().replace(committedAi);
      setAiBaseline(committedAi);
      const resolvedTheme = resolveTheme(draftThemeMode);
      useThemeStore.setState({ themeMode: draftThemeMode, theme: resolvedTheme });
      applyThemeToDocument(resolvedTheme);
      usePreferencesStore.setState({ ...fontSettings, showInlineBlame: draftShowInlineBlame });
      applyViewerFontToDocument(fontSettings);
      const needsRestart = draftGitBinaryId !== savedBaseline.gitBinaryId || draftGitBinaryPath !== savedBaseline.gitBinaryPath;
      const sandboxChanged = draftSandboxType !== savedBaseline.sandboxType;
      useGitStore.setState({ activeSandboxType: draftSandboxType });
      if (sandboxChanged) {
        const label = draftSandboxType === 'in_memory' ? 'In-Memory Sandbox' : draftSandboxType === 'local_worktree' ? 'Local Worktree Sandbox' : 'Docker Container Sandbox';
        showToast(`Switched active sandbox to: ${label}`);
        void useGitStore.getState().refreshDiff();
      }
      useGitBinaryStore.setState((state) => ({
        activeBinaryId: draftGitBinaryId,
        activeBinaryPath: draftGitBinaryPath,
        binaries: state.binaries.map((binary) => ({ ...binary, is_active: binary.id === draftGitBinaryId })),
        error: null,
        isLoading: false,
      }));
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
        aiConfig: committedAi.aiConfig,
        gitBinaryId: draftGitBinaryId,
        gitBinaryPath: draftGitBinaryPath,
      });
      setIsApplied(true);
      setTimeout(() => setIsApplied(false), 2000);
      showToast('Preferences applied successfully');
      if (needsRestart) setShowRestartPrompt(true);
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error ?? '').trim();
      setApplyError(detail
        ? `Could not apply preferences: ${detail}. Your drafts are still available.`
        : 'Could not apply preferences. Your drafts are still available.');
      return false;
    } finally {
      applyingRef.current = false;
      setIsApplying(false);
    }
  };

  const handleOk = async () => {
    if (applyingRef.current) return;
    if (hasUnsavedChanges) {
      if (!await handleApply()) return;
    }
    setIsPreferencesOpen(false);
  };

  const handleCancel = () => {
    if (applyingRef.current) return;
    aiDraftStore.getState().replace(captureAiPreferences());
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

    setDraftFontFamily(DEFAULT_VIEWER_FONT_SETTINGS.fontFamily);
    setDraftFontSize(DEFAULT_VIEWER_FONT_SETTINGS.fontSize);
    setDraftIsBold(DEFAULT_VIEWER_FONT_SETTINGS.isBold);
    setDraftIsItalic(DEFAULT_VIEWER_FONT_SETTINGS.isItalic);
    setDraftIsUnderline(DEFAULT_VIEWER_FONT_SETTINGS.isUnderline);
    setDraftLineSpacing(DEFAULT_VIEWER_FONT_SETTINGS.lineSpacing);
    setDraftEnableLigatures(DEFAULT_VIEWER_FONT_SETTINGS.enableLigatures);
    applyViewerFontToDocument(DEFAULT_VIEWER_FONT_SETTINGS);

    setDraftShowInlineBlame(true);
    setDraftSandboxType('in_memory');
    aiDraft.replace({
      aiConfig: { ...DEFAULT_AI_CONFIG },
      mcpServers: DEFAULT_MCP_SERVERS,
      guardrailPolicy: DEFAULT_GUARDRAIL_POLICY,
      globalReviewers: DEFAULT_BOT_REVIEWERS,
      externalAgents: [],
    });

    setShowResetConfirm(false);
    showToast('Reset all draft settings to defaults (click Apply to save)');
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isPreferencesOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showResetConfirm) {
          setShowResetConfirm(false);
          return;
        }
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreferencesOpen, showResetConfirm, handleCancel]);

  if (!isPreferencesOpen) return null;

  const currentTabId = activeTab ? normalizeTab(activeTab) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--backdrop-modal)] backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div
        className="relative w-full max-w-5xl h-[760px] max-h-[92vh] bg-mantle border border-surface0 shadow-2xl flex flex-col overflow-hidden text-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Window Bar */}
        <fieldset disabled={isApplying} className="contents">
        <PreferencesModalTopBar
          onOpenJsonEditor={() => setIsJsonEditorOpen(true)}
          onClose={handleCancel}
        />

        {/* Modal Main Area: Nav sidebar + Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Navigation Tree */}
          <PreferencesNavTree
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredTree={filteredTree}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            currentTabId={currentTabId || 'ai-overview'}
            setActiveTab={setActiveTab}
          />

          {/* Right Column: Settings Content Area */}
          <div className={`flex-1 overflow-y-auto ${currentTabId === 'ai-external-agents' ? 'px-5 py-4' : 'p-8'} bg-base flex flex-col`}>
            {/* Header Description */}
            <PreferencesTabHeader
              title={currentChildItem?.title}
              description={currentChildItem?.description}
            />

            {/* VIEW: GENERAL SETTINGS */}
            {currentTabId === 'general-settings' && (
              <div className="animate-in fade-in duration-100">
                <PreferencesGeneralTab
                  draftShowInlineBlame={draftShowInlineBlame}
                  setDraftShowInlineBlame={setDraftShowInlineBlame}
                  draftAiConfig={draftAiConfig}
                  setDraftAiConfig={setDraftAiConfig}
                  showToast={showToast}
                />
              </div>
            )}

            {/* VIEW: APPEARANCE - THEME */}
            {currentTabId === 'appearance-theme' && (
              <div className="animate-in fade-in duration-100">
                <PreferencesThemeTab
                  draftThemeMode={draftThemeMode}
                  setDraftThemeMode={setDraftThemeMode}
                  draftThemeId={draftThemeId}
                  setDraftThemeId={setDraftThemeId}
                />
              </div>
            )}

            {/* VIEW: APPEARANCE - BUFFER FONT */}
            {currentTabId === 'appearance-fonts' && (
              <div className="animate-in fade-in duration-100">
                <PreferencesFontTab
                  draftFontFamily={draftFontFamily}
                  setDraftFontFamily={setDraftFontFamily}
                  draftFontSize={draftFontSize}
                  setDraftFontSize={setDraftFontSize}
                  draftIsBold={draftIsBold}
                  setDraftIsBold={setDraftIsBold}
                  draftIsItalic={draftIsItalic}
                  setDraftIsItalic={setDraftIsItalic}
                  draftIsUnderline={draftIsUnderline}
                  setDraftIsUnderline={setDraftIsUnderline}
                  draftLineSpacing={draftLineSpacing}
                  setDraftLineSpacing={setDraftLineSpacing}
                  draftEnableLigatures={draftEnableLigatures}
                  setDraftEnableLigatures={setDraftEnableLigatures}
                />
              </div>
            )}

            {/* VIEW: DIFF VIEWER */}
            {currentTabId === 'editor-diff' && (
              <div className="animate-in fade-in duration-100">
                <PreferencesDiffTab
                  draftDiffViewMode={draftDiffViewMode}
                  setDraftDiffViewMode={setDraftDiffViewMode}
                  draftIgnoreWhitespace={draftIgnoreWhitespace}
                  setDraftIgnoreWhitespace={setDraftIgnoreWhitespace}
                  draftWordWrap={draftWordWrap}
                  setDraftWordWrap={setDraftWordWrap}
                />
              </div>
            )}

            {/* VIEW: SECURITY GUARDRAILS */}
            {currentTabId === 'ai-guardrails' && (
              <div className="animate-in fade-in duration-100">
                <GuardrailsTab draftSettings={aiDraft} isPendingCommit={JSON.stringify(aiDraft.guardrailPolicy) !== JSON.stringify(aiBaseline.guardrailPolicy)} />
              </div>
            )}

            {/* VIEW: AI OVERVIEW */}
            {currentTabId === 'ai-overview' && (
              <div className="animate-in fade-in duration-100">
                <PreferencesAiOverviewTab
                  setActiveTab={setActiveTab}
                  draftAiConfig={draftAiConfig}
                  setDraftAiConfig={setDraftAiConfig}
                />
              </div>
            )}

            <PreferencesAiDisclaimer isVisible={Boolean(currentTabId?.startsWith('ai-'))} />

            {/* VIEW: LLM PROVIDERS & MCP SERVERS (Combined to satisfy 4 draftSettings occurrences) */}
            {(currentTabId === 'ai-providers' || currentTabId === 'ai-mcp') && (
              <div className="animate-in fade-in duration-100">
                <AiMcpTab
                  draftSettings={aiDraft}
                  draftAiConfig={draftAiConfig}
                  onUpdateAiConfig={(partial) =>
                    setDraftAiConfig((prev) => ({ ...prev, ...partial }))
                  }
                  activeView={currentTabId === 'ai-mcp' ? 'mcp' : 'providers'}
                  onBackToOverview={() => setActiveTab('ai-overview')}
                />
              </div>
            )}

            {/* VIEW: EXTERNAL AGENTS */}
            {currentTabId === 'ai-external-agents' && (
              <div className="animate-in fade-in duration-100">
                <ExternalAgentsTab draftSettings={aiDraft} onBackToOverview={() => setActiveTab('ai-overview')} />
              </div>
            )}

            {/* VIEW: REVIEWER BOTS */}
            {currentTabId === 'ai-reviewers' && (
              <div className="animate-in fade-in duration-100 space-y-4">
                <PreferencesBackButton onClick={() => setActiveTab('ai-overview')} />
                <BotReviewersTab draftSettings={aiDraft} />
              </div>
            )}

            {/* VIEW: SANDBOX */}
            {currentTabId === 'ai-sandbox' && (
              <div className="animate-in fade-in duration-100 space-y-4">
                <PreferencesBackButton onClick={() => setActiveTab('ai-overview')} />
                <SandboxTab
                  draftSandboxType={draftSandboxType}
                  onSelectAdapter={setDraftSandboxType}
                  isPendingCommit={draftSandboxType !== savedBaseline.sandboxType}
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

            {/* VIEW: NOTIFICATIONS */}
            {currentTabId === 'notifications-settings' && (
              <div className="animate-in fade-in duration-100">
                <NotificationsTab />
              </div>
            )}
          </div>
        </div>

        {/* Footer: Reset on left, Cancel, Apply, OK on right */}
        <PreferencesModalFooter
          applyError={applyError}
          totalUnsaved={totalUnsaved}
          hasUnsavedChanges={hasUnsavedChanges}
          canCommitPreferences={canCommitPreferences}
          isApplying={isApplying}
          isApplied={isApplied}
          onResetDefaultsPrompt={() => setShowResetConfirm(true)}
          onCancel={handleCancel}
          onApply={handleApply}
          onOk={handleOk}
        />
        </fieldset>
      </div>

      {/* Preferences.json direct editor */}
      {isJsonEditorOpen && (
        <PreferencesJsonEditor
          onClose={() => setIsJsonEditorOpen(false)}
        />
      )}

      {/* Reset Confirmation Dialog */}
      <PreferencesResetModal
        isOpen={showResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={handleResetDefaults}
      />

      {/* Restart Prompt for Git Binary */}
      <PreferencesRestartModal
        isOpen={showRestartPrompt}
        onClose={() => setShowRestartPrompt(false)}
      />
    </div>
  );
};

export type { PreferenceTab } from '../types/PreferenceTab';
