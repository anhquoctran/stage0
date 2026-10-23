import React from 'react';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { Check } from '../../../common/components/icons/Check';
import { Info } from '../../../common/components/icons/Info';
import { X } from '../../../common/components/icons/X';
import { ConflictBanner } from '../../../features/git/components/ConflictBanner';
import { NotificationDrawer } from '../../../features/notifications/components/NotificationDrawer';
import { EmptyVirtualMrWorkspace } from '../../../features/virtual-mr/components/EmptyVirtualMrWorkspace';
import { VirtualMrCommitsTab } from '../../../features/virtual-mr/components/hub/VirtualMrCommitsTab';
import { VirtualMrOverviewTab } from '../../../features/virtual-mr/components/hub/VirtualMrOverviewTab';
import { VirtualMrReviewsTab } from '../../../features/virtual-mr/components/hub/VirtualMrReviewsTab';
import { NewVirtualMrView } from '../../../features/virtual-mr/components/NewVirtualMrView';
import { VirtualMrBottomBar } from '../../../features/virtual-mr/components/VirtualMrBottomBar';
import { VirtualMrHub } from '../../../features/virtual-mr/components/VirtualMrHub';
import { VirtualMrListDialog } from '../../../features/virtual-mr/components/VirtualMrListDialog';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import { useMainLayoutCoordination } from '../hooks/useMainLayoutCoordination';
import { MainLayoutDiffWorkspace } from './MainLayoutDiffWorkspace';
import { MainLayoutModals } from './MainLayoutModals';
import { StatusBar } from './StatusBar';
import { TabBar } from './TabBar';
import { TopBar } from './TopBar';
import { WelcomeScreen } from './WelcomeScreen';

export const MainLayout: React.FC = () => {
  const {
    currentRepo,
    diffPayload,
    conflictReport,
    selectedFile,
    viewMode,
    isDiffLoading,
    error,
    clearError,
    selectFile,
    setViewMode,
    openRepoDialog,
    toastMessage,
    toastLevel,
    isRepoSettingsOpen,
    closeRepoSettings,
    repoSettingsActiveTab,
    sessions,
    isLoadingSessions,
    activeSessionId,
    draftMr,
    isDraftActive,
    openNewMrDraft,
    repoSettings,
    sidebarWidth,
    isResizing,
    startResizing,
    resetSidebarWidth,
    handleSelectConflictFile,
  } = useMainLayoutCoordination();

  const activeMrTab = useVirtualMrStore((state) => state.activeMrTab);
  const currentSession = sessions.find((s) => s.id === activeSessionId) || null;

  return (
    <div className="relative flex flex-col h-full w-full flex-1 overflow-hidden bg-crust text-text font-sans">
      {/* Top Application Bar with Menu Bar & Action Toolbar */}
      <TopBar />

      {/* Multi-Session Virtual MR TabBar */}
      {currentRepo && <TabBar />}

      {/* Virtual MR Details Hub (Only rendered for established MR sessions, not during initial branch comparison) */}
      {currentRepo && !isDraftActive && activeSessionId && <VirtualMrHub />}

      <MainLayoutModals
        isRepoSettingsOpen={isRepoSettingsOpen}
        closeRepoSettings={closeRepoSettings}
        repoSettingsActiveTab={repoSettingsActiveTab}
      />
      {/* In-Memory Merge Conflict Banner */}
      <ConflictBanner
        conflictReport={conflictReport}
        onSelectConflictFile={handleSelectConflictFile}
      />

      {/* Global Error Banner */}
      {error && (
        <div className="bg-red/15 border-b border-red/30 px-4 py-2 flex items-center justify-between text-text text-xs shrink-0 z-10 rounded-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red shrink-0" />
            <span className="font-mono text-red font-medium">{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="p-1 hover:bg-red/20 rounded-sm text-red hover:text-text transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Central Review Workspace */}
      <main className="flex-1 flex overflow-hidden relative">
        {currentRepo ? (
          draftMr && isDraftActive ? (
            <NewVirtualMrView />
          ) : activeSessionId && currentSession ? (
            activeMrTab === 'overview' ? (
              <VirtualMrOverviewTab session={currentSession} />
            ) : activeMrTab === 'commits' ? (
              <VirtualMrCommitsTab session={currentSession} />
            ) : activeMrTab === 'reviews' ? (
              <VirtualMrReviewsTab session={currentSession} />
            ) : (
              <MainLayoutDiffWorkspace
                diffPayload={diffPayload}
                selectedFile={selectedFile}
                selectFile={selectFile}
                isDiffLoading={isDiffLoading}
                sidebarWidth={sidebarWidth}
                isResizing={isResizing}
                startResizing={startResizing}
                resetSidebarWidth={resetSidebarWidth}
                viewMode={viewMode}
                setViewMode={setViewMode}
                openRepoDialog={openRepoDialog}
              />
            )
          ) : isLoadingSessions || sessions.length > 0 ? (
            <VirtualMrListDialog inline />
          ) : (
            <EmptyVirtualMrWorkspace
              onNewMr={() => openNewMrDraft()}
              repoName={currentRepo.name}
              defaultBaseBranch={repoSettings?.defaultBaseBranch || 'main'}
            />
          )
        ) : (
          <WelcomeScreen />
        )}
      </main>

      {/* Bottom Action Bar for Active Virtual MR Tab */}
      {currentRepo && !isDraftActive && activeSessionId && <VirtualMrBottomBar />}

      {/* Bottom Status Bar */}
      <StatusBar />
      <NotificationDrawer />

      {/* Global Feedback Toast */}
      {toastMessage && (
        <div
          role={toastLevel === 'error' ? 'alert' : 'status'}
          className="fixed bottom-10 right-6 z-50 bg-mantle border border-surface1 text-text text-xs px-3.5 py-2 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 rounded-sm"
        >
          {toastLevel === 'error' || toastLevel === 'warning' ? (
            <AlertCircle
              className={`w-3.5 h-3.5 shrink-0 ${toastLevel === 'error' ? 'text-red' : 'text-yellow'}`}
            />
          ) : toastLevel === 'info' ? (
            <Info className="w-3.5 h-3.5 text-primary shrink-0" />
          ) : (
            <Check className="w-3.5 h-3.5 text-green shrink-0" />
          )}
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
