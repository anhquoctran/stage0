import React from 'react';
import { usePreferencesDraft } from '../hooks/usePreferencesDraft';
import { normalizeTab } from '../utils/normalizePreferenceTab';
import { PreferencesJsonEditor } from './PreferencesJsonEditor';
import { PreferencesModalFooter } from './PreferencesModalFooter';
import { PreferencesModalTopBar } from './PreferencesModalTopBar';
import { PreferencesNavTree } from './PreferencesNavTree';
import { PreferencesResetModal } from './PreferencesResetModal';
import { PreferencesRestartModal } from './PreferencesRestartModal';
import { PreferencesTabContainer } from './PreferencesTabContainer';

export const PreferencesModal: React.FC = () => {
  const {
    transaction: {
      isPreferencesOpen,
      showToast,
      isApplying,
      applyError,
      isJsonEditorOpen,
      setIsJsonEditorOpen,
      savedBaseline,
      isApplied,
      showResetConfirm,
      setShowResetConfirm,
      showRestartPrompt,
      setShowRestartPrompt,
      totalUnsaved,
      hasUnsavedChanges,
      canCommitPreferences,
      handleApply,
      handleOk,
      handleCancel,
      handleResetDefaults,
    },
    ai: { aiDraft, aiBaseline, draftAiConfig, setDraftAiConfig },
    keymaps: { draftKeymap, setDraftKeymap },
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
      draftUiFontFamily,
      setDraftUiFontFamily,
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
      draftMarkdownFontFamily,
      setDraftMarkdownFontFamily,
      draftMarkdownCodeFontFamily,
      setDraftMarkdownCodeFontFamily,
      draftMarkdownEditorFontFamily,
      setDraftMarkdownEditorFontFamily,
      draftMarkdownFontSize,
      setDraftMarkdownFontSize,
      draftMarkdownHeadingWeight,
      setDraftMarkdownHeadingWeight,
    },
    diff: {
      draftDiffViewMode,
      setDraftDiffViewMode,
      draftIgnoreWhitespace,
      setDraftIgnoreWhitespace,
      draftWordWrap,
      setDraftWordWrap,
      draftShowInlineBlame,
      setDraftShowInlineBlame,
    },
    general: {
      draftLaunchAtStartup,
      setDraftLaunchAtStartup,
      draftStartInBackground,
      setDraftStartInBackground,
      draftExplorerContextMenu,
      setDraftExplorerContextMenu,
      draftAddToPath,
      setDraftAddToPath,
    },
    sandbox: { draftSandboxType, setDraftSandboxType },
    git: { draftGitBinaryId, setDraftGitBinaryId, draftGitBinaryPath, setDraftGitBinaryPath },
  } = usePreferencesDraft();

  if (!isPreferencesOpen) return null;

  const currentTabId = activeTab ? normalizeTab(activeTab) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[var(--backdrop-modal)] backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div
        role="dialog" aria-modal="true" aria-label="Preferences"
        className="relative w-full max-w-5xl h-[760px] max-h-[calc(100vh-2rem)] bg-mantle border border-surface0 shadow-2xl flex flex-col overflow-hidden text-text rounded-sm"
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
              currentTabId={currentTabId}
              setActiveTab={setActiveTab}
            />

            {/* Right Column: Settings Content Area */}
            <PreferencesTabContainer
              draftUiFontFamily={draftUiFontFamily}
              setDraftUiFontFamily={setDraftUiFontFamily}
              draftKeymap={draftKeymap}
              setDraftKeymap={setDraftKeymap}
              currentTabId={currentTabId}
              currentChildItem={currentChildItem}
              draftShowInlineBlame={draftShowInlineBlame}
              setDraftShowInlineBlame={setDraftShowInlineBlame}
              draftLaunchAtStartup={draftLaunchAtStartup}
              setDraftLaunchAtStartup={setDraftLaunchAtStartup}
              draftStartInBackground={draftStartInBackground}
              setDraftStartInBackground={setDraftStartInBackground}
              draftExplorerContextMenu={draftExplorerContextMenu}
              setDraftExplorerContextMenu={setDraftExplorerContextMenu}
              draftAddToPath={draftAddToPath}
              setDraftAddToPath={setDraftAddToPath}
              draftAiConfig={draftAiConfig}
              setDraftAiConfig={setDraftAiConfig}
              showToast={showToast}
              draftThemeMode={draftThemeMode}
              setDraftThemeMode={setDraftThemeMode}
              draftThemeId={draftThemeId}
              setDraftThemeId={setDraftThemeId}
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
              draftMarkdownFontFamily={draftMarkdownFontFamily}
              setDraftMarkdownFontFamily={setDraftMarkdownFontFamily}
              draftMarkdownCodeFontFamily={draftMarkdownCodeFontFamily}
              setDraftMarkdownCodeFontFamily={setDraftMarkdownCodeFontFamily}
              draftMarkdownEditorFontFamily={draftMarkdownEditorFontFamily}
              setDraftMarkdownEditorFontFamily={setDraftMarkdownEditorFontFamily}
              draftMarkdownFontSize={draftMarkdownFontSize}
              setDraftMarkdownFontSize={setDraftMarkdownFontSize}
              draftMarkdownHeadingWeight={draftMarkdownHeadingWeight}
              setDraftMarkdownHeadingWeight={setDraftMarkdownHeadingWeight}
              draftDiffViewMode={draftDiffViewMode}
              setDraftDiffViewMode={setDraftDiffViewMode}
              draftIgnoreWhitespace={draftIgnoreWhitespace}
              setDraftIgnoreWhitespace={setDraftIgnoreWhitespace}
              draftWordWrap={draftWordWrap}
              setDraftWordWrap={setDraftWordWrap}
              aiDraft={aiDraft}
              aiBaseline={aiBaseline}
              setActiveTab={setActiveTab}
              draftSandboxType={draftSandboxType}
              setDraftSandboxType={setDraftSandboxType}
              savedBaseline={savedBaseline}
              draftGitBinaryId={draftGitBinaryId}
              draftGitBinaryPath={draftGitBinaryPath}
              setDraftGitBinaryId={setDraftGitBinaryId}
              setDraftGitBinaryPath={setDraftGitBinaryPath}
            />
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
      {isJsonEditorOpen && <PreferencesJsonEditor onClose={() => setIsJsonEditorOpen(false)} />}

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
