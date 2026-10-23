import { AiMcpTab } from '../../ai/components/AiMcpTab';
import { BotReviewersTab } from '../../ai/components/BotReviewersTab';
import { ExternalAgentsTab } from '../../ai/components/ExternalAgentsTab';
import { GuardrailsTab } from '../../ai/components/GuardrailsTab';
import { SandboxTab } from '../../ai/components/SandboxTab';
import { GitCredentialsTab } from '../../credentials/components/GitCredentialsTab';
import { GitBinaryTab } from '../../git/components/GitBinaryTab';
import { NotificationsTab } from '../../notifications/components/NotificationsTab';
import { PreferencesAiDisclaimer } from './PreferencesAiDisclaimer';
import { PreferencesBackButton } from './PreferencesBackButton';
import type { PreferencesTabContainerProps } from './PreferencesTabContainerProps';
import { PreferencesTabHeader } from './PreferencesTabHeader';
import { PreferencesAiOverviewTab } from './tabs/PreferencesAiOverviewTab';
import { PreferencesDiffTab } from './tabs/PreferencesDiffTab';
import { PreferencesFontTab } from './tabs/PreferencesFontTab';
import { PreferencesGeneralTab } from './tabs/PreferencesGeneralTab';
import { PreferencesMarkdownFontTab } from './tabs/PreferencesMarkdownFontTab';
import { PreferencesThemeTab } from './tabs/PreferencesThemeTab';

export function PreferencesTabContainer({
  currentTabId,
  currentChildItem,
  draftShowInlineBlame,
  setDraftShowInlineBlame,
  draftAiConfig,
  setDraftAiConfig,
  showToast,
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
  draftMarkdownFontSize,
  setDraftMarkdownFontSize,
  draftMarkdownHeadingWeight,
  setDraftMarkdownHeadingWeight,
  draftDiffViewMode,
  setDraftDiffViewMode,
  draftIgnoreWhitespace,
  setDraftIgnoreWhitespace,
  draftWordWrap,
  setDraftWordWrap,
  aiDraft,
  aiBaseline,
  setActiveTab,
  draftSandboxType,
  setDraftSandboxType,
  savedBaseline,
  draftGitBinaryId,
  draftGitBinaryPath,
  setDraftGitBinaryId,
  setDraftGitBinaryPath,
}: PreferencesTabContainerProps) {
  return (
    <div
      className={`flex-1 overflow-y-auto rounded-sm ${currentTabId === 'ai-external-agents' ? 'px-5 py-4' : 'p-8'} bg-base flex flex-col`}
    >
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

      {/* VIEW: APPEARANCE - MARKDOWN FONT */}
      {currentTabId === 'appearance-markdown-font' && (
        <div className="animate-in fade-in duration-100">
          <PreferencesMarkdownFontTab
            draftMarkdownFontFamily={draftMarkdownFontFamily}
            setDraftMarkdownFontFamily={setDraftMarkdownFontFamily}
            draftMarkdownCodeFontFamily={draftMarkdownCodeFontFamily}
            setDraftMarkdownCodeFontFamily={setDraftMarkdownCodeFontFamily}
            draftMarkdownFontSize={draftMarkdownFontSize}
            setDraftMarkdownFontSize={setDraftMarkdownFontSize}
            draftMarkdownHeadingWeight={draftMarkdownHeadingWeight}
            setDraftMarkdownHeadingWeight={setDraftMarkdownHeadingWeight}
            editorFontFamily={draftFontFamily}
            editorFontSize={draftFontSize}
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
          <GuardrailsTab
            draftSettings={aiDraft}
            isPendingCommit={
              JSON.stringify(aiDraft.guardrailPolicy) !== JSON.stringify(aiBaseline.guardrailPolicy)
            }
          />
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
            onUpdateAiConfig={(partial) => setDraftAiConfig((prev) => ({ ...prev, ...partial }))}
            activeView={currentTabId === 'ai-mcp' ? 'mcp' : 'providers'}
            onBackToOverview={() => setActiveTab('ai-overview')}
          />
        </div>
      )}

      {/* VIEW: EXTERNAL AGENTS */}
      {currentTabId === 'ai-external-agents' && (
        <div className="animate-in fade-in duration-100">
          <ExternalAgentsTab
            draftSettings={aiDraft}
            onBackToOverview={() => setActiveTab('ai-overview')}
          />
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
  );
}
