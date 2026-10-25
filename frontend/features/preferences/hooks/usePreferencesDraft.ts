import { useEffect, useRef, useState } from 'react';
import {
  applyThemeToDocument,
  resolveTheme,
  useThemeStore,
} from '../../../core/store/useThemeStore';
import { DEFAULT_AI_CONFIG, DEFAULT_MCP_SERVERS } from '../../ai/constants/aiPresets';
import { DEFAULT_BOT_REVIEWERS } from '../../ai/constants/botPresets';
import { captureAiPreferences } from '../../ai/services/commitAiPreferences';
import { createAiPreferencesDraft } from '../../ai/store/createAiPreferencesDraft';
import { type AiConfig } from '../../ai/types/AiConfig';
import { DEFAULT_GUARDRAIL_POLICY } from '../../ai/types/guardrails';
import { useGitBinaryStore } from '../../git/store/useGitBinaryStore';
import { useGitStore } from '../../git/store/useGitStore';
import { createPreferencesApplyAction } from '../services/createPreferencesApplyAction';
import { DEFAULT_MARKDOWN_FONT_SETTINGS } from '../constants/markdownFonts';
import { applyMarkdownFontToDocument } from '../utils/applyMarkdownFontToDocument';
import {
  applyViewerFontToDocument,
  DEFAULT_VIEWER_FONT_SETTINGS,
  usePreferencesStore,
} from '../store/usePreferencesStore';
import { type ViewerFontSettings } from '../types/ViewerFontSettings';
import { usePreferencesChangeCount } from './usePreferencesChangeCount';
import { usePreferencesDraftSession } from './usePreferencesDraftSession';
import { usePreferencesNavigation } from './usePreferencesNavigation';
import { usePreferencesDismiss } from './usePreferencesDismiss';
import { DEFAULT_KEYMAP } from '../../../core/services/keymaps/catalog';
import { DEFAULT_UI_FONT_FAMILY } from '../constants/uiFonts';
import { applyUiFontToDocument } from '../utils/applyUiFontToDocument';

export function usePreferencesDraft() {
  const {
    isPreferencesOpen,
    keymap: storedKeymap,
    uiFontFamily: storedUiFontFamily,
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
    markdownFontFamily: storedMarkdownFontFamily,
    markdownCodeFontFamily: storedMarkdownCodeFontFamily,
    markdownEditorFontFamily: storedMarkdownEditorFontFamily,
    markdownFontSize: storedMarkdownFontSize,
    markdownHeadingFontWeight: storedMarkdownHeadingWeight,
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

  const {
    setSearchQuery,
    setActiveTab,
    setExpandedGroups,
    activeTab,
    searchQuery,
    expandedGroups,
    toggleGroup,
    filteredTree,
    currentChildItem,
  } = usePreferencesNavigation({
    isPreferencesOpen,
    initialPreferencesTab,
    setInitialPreferencesTab,
  });

  const [isJsonEditorOpen, setIsJsonEditorOpen] = useState(false);

  const session = usePreferencesDraftSession({
    storedKeymap,
    storedUiFontFamily,
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
    storedGitBinaryId,
    storedGitBinaryPath,
    storedAiConfig,
    storedMarkdownFontFamily,
    storedMarkdownCodeFontFamily,
    storedMarkdownEditorFontFamily,
    storedMarkdownFontSize,
    storedMarkdownHeadingWeight,
    isPreferencesOpen,
    aiDraftStore,
    setAiBaseline,
    setApplyError,
    fetchActiveBinary,
    setSearchQuery,
    setActiveTab,
    setExpandedGroups,
  });

  // Unsaved count calculation
  const { totalUnsaved } = usePreferencesChangeCount({
    session,
    aiDraft,
    aiBaseline,
    draftAiConfig,
  });

  const hasUnsavedChanges = totalUnsaved > 0;
  const canCommitPreferences = hasUnsavedChanges && !isApplying;
  useEffect(() => {
    if (hasUnsavedChanges) session.setIsApplied(false);
  }, [hasUnsavedChanges, aiDraft]);

  // Commit changes
  const handleApply = createPreferencesApplyAction({
    draftKeymap: session.draftKeymap,
    draftUiFontFamily: session.draftUiFontFamily,
    setDraftKeymap: session.setDraftKeymap,
    applyingRef,
    setIsApplying,
    setApplyError,
    draftFontFamily: session.draftFontFamily,
    draftFontSize: session.draftFontSize,
    draftIsBold: session.draftIsBold,
    draftIsItalic: session.draftIsItalic,
    draftIsUnderline: session.draftIsUnderline,
    draftLineSpacing: session.draftLineSpacing,
    draftEnableLigatures: session.draftEnableLigatures,
    draftMarkdownFontFamily: session.draftMarkdownFontFamily,
    draftMarkdownCodeFontFamily: session.draftMarkdownCodeFontFamily,
    draftMarkdownEditorFontFamily: session.draftMarkdownEditorFontFamily,
    draftMarkdownFontSize: session.draftMarkdownFontSize,
    draftMarkdownHeadingWeight: session.draftMarkdownHeadingWeight,
    draftThemeMode: session.draftThemeMode,
    savedBaseline: session.savedBaseline,
    draftShowInlineBlame: session.draftShowInlineBlame,
    draftSandboxType: session.draftSandboxType,
    draftGitBinaryId: session.draftGitBinaryId,
    draftGitBinaryPath: session.draftGitBinaryPath,
    aiDraftStore,
    aiBaseline,
    setAiBaseline,
    showToast,
    setSavedBaseline: session.setSavedBaseline,
    setIsApplied: session.setIsApplied,
    setShowRestartPrompt: session.setShowRestartPrompt,
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
    const resolvedTheme = resolveTheme(session.savedBaseline.themeMode);
    applyThemeToDocument(resolvedTheme);
    applyUiFontToDocument(session.savedBaseline.uiFontFamily);

    const fontSettings: ViewerFontSettings = {
      fontFamily: session.savedBaseline.fontFamily,
      fontSize: session.savedBaseline.fontSize,
      isBold: session.savedBaseline.isBold,
      isItalic: session.savedBaseline.isItalic,
      isUnderline: session.savedBaseline.isUnderline,
      lineSpacing: session.savedBaseline.lineSpacing,
      enableLigatures: session.savedBaseline.enableLigatures,
    };
    applyViewerFontToDocument(fontSettings);
    applyMarkdownFontToDocument({
      fontFamily: session.savedBaseline.markdownFontFamily,
      codeFontFamily: session.savedBaseline.markdownCodeFontFamily,
      editorFontFamily: session.savedBaseline.markdownEditorFontFamily,
      fontSize: session.savedBaseline.markdownFontSize,
      headingFontWeight: session.savedBaseline.markdownHeadingWeight,
    });

    setIsPreferencesOpen(false);
  };

  usePreferencesDismiss({
    isOpen: isPreferencesOpen,
    hasChildDialog: isJsonEditorOpen || session.showResetConfirm || session.showRestartPrompt,
    onCancel: handleCancel,
  });

  const handleResetDefaults = () => {
    session.setDraftKeymap(structuredClone(DEFAULT_KEYMAP));
    session.setDraftUiFontFamily(DEFAULT_UI_FONT_FAMILY);
    applyUiFontToDocument(DEFAULT_UI_FONT_FAMILY);
    session.setDraftThemeMode('system');
    applyThemeToDocument(resolveTheme('system'));

    session.setDraftFontFamily(DEFAULT_VIEWER_FONT_SETTINGS.fontFamily);
    session.setDraftFontSize(DEFAULT_VIEWER_FONT_SETTINGS.fontSize);
    session.setDraftIsBold(DEFAULT_VIEWER_FONT_SETTINGS.isBold);
    session.setDraftIsItalic(DEFAULT_VIEWER_FONT_SETTINGS.isItalic);
    session.setDraftIsUnderline(DEFAULT_VIEWER_FONT_SETTINGS.isUnderline);
    session.setDraftLineSpacing(DEFAULT_VIEWER_FONT_SETTINGS.lineSpacing);
    session.setDraftEnableLigatures(DEFAULT_VIEWER_FONT_SETTINGS.enableLigatures);
    applyViewerFontToDocument(DEFAULT_VIEWER_FONT_SETTINGS);

    session.setDraftMarkdownFontFamily(DEFAULT_MARKDOWN_FONT_SETTINGS.fontFamily);
    session.setDraftMarkdownCodeFontFamily(DEFAULT_MARKDOWN_FONT_SETTINGS.codeFontFamily);
    session.setDraftMarkdownEditorFontFamily(DEFAULT_MARKDOWN_FONT_SETTINGS.editorFontFamily);
    session.setDraftMarkdownFontSize(DEFAULT_MARKDOWN_FONT_SETTINGS.fontSize);
    session.setDraftMarkdownHeadingWeight(DEFAULT_MARKDOWN_FONT_SETTINGS.headingFontWeight);
    applyMarkdownFontToDocument(DEFAULT_MARKDOWN_FONT_SETTINGS);

    session.setDraftShowInlineBlame(true);
    session.setDraftSandboxType('in_memory');
    aiDraft.replace({
      aiConfig: { ...DEFAULT_AI_CONFIG },
      mcpServers: DEFAULT_MCP_SERVERS,
      guardrailPolicy: DEFAULT_GUARDRAIL_POLICY,
      globalReviewers: DEFAULT_BOT_REVIEWERS,
      externalAgents: [],
    });

    session.setShowResetConfirm(false);
    showToast('Reset all draft settings to defaults (click Apply to save)');
  };

  return {
    transaction: {
      isPreferencesOpen,
      showToast,
      isApplying,
      applyError,
      isJsonEditorOpen,
      setIsJsonEditorOpen,
      savedBaseline: session.savedBaseline,
      isApplied: session.isApplied,
      showResetConfirm: session.showResetConfirm,
      setShowResetConfirm: session.setShowResetConfirm,
      showRestartPrompt: session.showRestartPrompt,
      setShowRestartPrompt: session.setShowRestartPrompt,
      totalUnsaved,
      hasUnsavedChanges,
      canCommitPreferences,
      handleApply,
      handleOk,
      handleCancel,
      handleResetDefaults,
    },
    ai: { aiDraft, aiBaseline, draftAiConfig, setDraftAiConfig },
    keymaps: { draftKeymap: session.draftKeymap, setDraftKeymap: session.setDraftKeymap },
    navigation: {
      activeTab,
      setActiveTab,
      searchQuery,
      setSearchQuery,
      expandedGroups,
      toggleGroup,
      filteredTree,
      currentChildItem,
    },
    appearance: {
      draftUiFontFamily: session.draftUiFontFamily,
      setDraftUiFontFamily: session.setDraftUiFontFamily,
      draftThemeMode: session.draftThemeMode,
      setDraftThemeMode: session.setDraftThemeMode,
      draftThemeId: session.draftThemeId,
      setDraftThemeId: session.setDraftThemeId,
      draftFontFamily: session.draftFontFamily,
      setDraftFontFamily: session.setDraftFontFamily,
      draftFontSize: session.draftFontSize,
      setDraftFontSize: session.setDraftFontSize,
      draftIsBold: session.draftIsBold,
      setDraftIsBold: session.setDraftIsBold,
      draftIsItalic: session.draftIsItalic,
      setDraftIsItalic: session.setDraftIsItalic,
      draftIsUnderline: session.draftIsUnderline,
      setDraftIsUnderline: session.setDraftIsUnderline,
      draftLineSpacing: session.draftLineSpacing,
      setDraftLineSpacing: session.setDraftLineSpacing,
      draftEnableLigatures: session.draftEnableLigatures,
      setDraftEnableLigatures: session.setDraftEnableLigatures,
      draftMarkdownFontFamily: session.draftMarkdownFontFamily,
      setDraftMarkdownFontFamily: session.setDraftMarkdownFontFamily,
      draftMarkdownCodeFontFamily: session.draftMarkdownCodeFontFamily,
      setDraftMarkdownCodeFontFamily: session.setDraftMarkdownCodeFontFamily,
      draftMarkdownEditorFontFamily: session.draftMarkdownEditorFontFamily,
      setDraftMarkdownEditorFontFamily: session.setDraftMarkdownEditorFontFamily,
      draftMarkdownFontSize: session.draftMarkdownFontSize,
      setDraftMarkdownFontSize: session.setDraftMarkdownFontSize,
      draftMarkdownHeadingWeight: session.draftMarkdownHeadingWeight,
      setDraftMarkdownHeadingWeight: session.setDraftMarkdownHeadingWeight,
    },
    diff: {
      draftDiffViewMode: session.draftDiffViewMode,
      setDraftDiffViewMode: session.setDraftDiffViewMode,
      draftIgnoreWhitespace: session.draftIgnoreWhitespace,
      setDraftIgnoreWhitespace: session.setDraftIgnoreWhitespace,
      draftWordWrap: session.draftWordWrap,
      setDraftWordWrap: session.setDraftWordWrap,
      draftShowInlineBlame: session.draftShowInlineBlame,
      setDraftShowInlineBlame: session.setDraftShowInlineBlame,
    },
    sandbox: {
      draftSandboxType: session.draftSandboxType,
      setDraftSandboxType: session.setDraftSandboxType,
    },
    git: {
      draftGitBinaryId: session.draftGitBinaryId,
      setDraftGitBinaryId: session.setDraftGitBinaryId,
      draftGitBinaryPath: session.draftGitBinaryPath,
      setDraftGitBinaryPath: session.setDraftGitBinaryPath,
    },
  };
}
