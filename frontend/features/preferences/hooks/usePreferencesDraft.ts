import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyThemeToDocument,
  resolveTheme,
  useThemeStore,
} from '../../../core/store/useThemeStore';
import { type ThemeMode } from '../../../core/types/ThemeMode';
import { DEFAULT_AI_CONFIG, DEFAULT_MCP_SERVERS } from '../../ai/constants/aiPresets';
import { DEFAULT_BOT_REVIEWERS } from '../../ai/constants/botPresets';
import { captureAiPreferences } from '../../ai/services/commitAiPreferences';
import { createAiPreferencesDraft } from '../../ai/store/createAiPreferencesDraft';
import { type AiConfig } from '../../ai/types/AiConfig';
import { DEFAULT_GUARDRAIL_POLICY } from '../../ai/types/guardrails';
import { aiPreferencesChangeCount } from '../../ai/utils/aiPreferencesSnapshot';
import { useGitBinaryStore } from '../../git/store/useGitBinaryStore';
import { useGitStore } from '../../git/store/useGitStore';
import { type SandboxType } from '../../git/types/SandboxType';
import { SETTINGS_TREE } from '../constants/settingsTree';
import { createPreferencesApplyAction } from '../services/createPreferencesApplyAction';
import {
  applyViewerFontToDocument,
  DEFAULT_VIEWER_FONT_SETTINGS,
  usePreferencesStore,
} from '../store/usePreferencesStore';
import type { PreferenceTab } from '../types/PreferenceTab';
import type { PreferencesBaseline } from '../types/PreferencesBaseline';
import { type ViewerFontSettings } from '../types/ViewerFontSettings';
import { countUnsavedPreferences } from '../utils/countUnsavedPreferences';
import { filterSettingsTree } from '../utils/filterSettingsTree';
import { findSettingChildItem } from '../utils/findSettingChildItem';
import { normalizeTab } from '../utils/normalizePreferenceTab';

export function usePreferencesDraft() {
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
    aiDraft.updateAiConfig(
      typeof next === 'function' ? next(aiDraftStore.getState().aiConfig) : next
    );
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
  useEffect(() => {
    if (hasUnsavedChanges) setIsApplied(false);
  }, [hasUnsavedChanges, aiDraft]);

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
  const handleApply = createPreferencesApplyAction({
    applyingRef,
    setIsApplying,
    setApplyError,
    draftFontFamily,
    draftFontSize,
    draftIsBold,
    draftIsItalic,
    draftIsUnderline,
    draftLineSpacing,
    draftEnableLigatures,
    draftThemeMode,
    savedBaseline,
    draftShowInlineBlame,
    draftSandboxType,
    draftGitBinaryId,
    draftGitBinaryPath,
    aiDraftStore,
    aiBaseline,
    setAiBaseline,
    showToast,
    setSavedBaseline,
    setIsApplied,
    setShowRestartPrompt,
  });

  const handleOk = async () => {
    if (applyingRef.current) return;
    if (hasUnsavedChanges) {
      if (!(await handleApply())) return;
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

  return {
    isPreferencesOpen,
    showToast,
    aiDraft,
    aiBaseline,
    draftAiConfig,
    setDraftAiConfig,
    isApplying,
    applyError,
    activeTab,
    setActiveTab,
    isJsonEditorOpen,
    setIsJsonEditorOpen,
    searchQuery,
    setSearchQuery,
    expandedGroups,
    toggleGroup,
    draftThemeMode,
    setDraftThemeMode,
    draftThemeId,
    setDraftThemeId,
    draftFontFamily,
    setDraftFontFamily,
    draftFontSize,
    setDraftFontSize,
    draftIsBold,
    setDraftIsBold,
    draftIsItalic,
    setDraftIsItalic,
    draftIsUnderline,
    setDraftIsUnderline,
    draftLineSpacing,
    setDraftLineSpacing,
    draftEnableLigatures,
    setDraftEnableLigatures,
    draftDiffViewMode,
    setDraftDiffViewMode,
    draftIgnoreWhitespace,
    setDraftIgnoreWhitespace,
    draftWordWrap,
    setDraftWordWrap,
    draftShowInlineBlame,
    setDraftShowInlineBlame,
    draftSandboxType,
    setDraftSandboxType,
    draftGitBinaryId,
    setDraftGitBinaryId,
    draftGitBinaryPath,
    setDraftGitBinaryPath,
    savedBaseline,
    isApplied,
    showResetConfirm,
    setShowResetConfirm,
    showRestartPrompt,
    setShowRestartPrompt,
    totalUnsaved,
    hasUnsavedChanges,
    canCommitPreferences,
    filteredTree,
    currentChildItem,
    handleApply,
    handleOk,
    handleCancel,
    handleResetDefaults,
  };
}
