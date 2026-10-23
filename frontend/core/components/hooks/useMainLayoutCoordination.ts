import { useEffect } from 'react';
import { useGitStore } from '../../../features/git/store/useGitStore';
import { getOsFileManagerName } from '../../../features/git/utils/fileActions';
import { usePreferencesStore } from '../../../features/preferences/store/usePreferencesStore';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import { useSidebarResizing } from './useSidebarResizing';
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts';

export function useMainLayoutCoordination() {
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
    selectNextFile,
    selectPrevFile,
    selectNextConflictFile,
    setViewMode,
    refreshDiff,
    runSync,
    setIsPullFromOpen,
    setIsMergeFromOpen,
    setIsRebaseFromOpen,
    openRepoDialog,
    setIsCloneModalOpen,
    remoteUrl,
    compareBranch,
    baseBranch,
    branches,
    toastMessage,
    toastLevel,
    showToast,
    setIsRemoteUrlFromOpen,
    setTargetFileForUrl,
  } = useGitStore();

  const { setIsPreferencesOpen, showInlineBlame, toggleInlineBlame } = usePreferencesStore();

  const {
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
  } = useVirtualMrStore();

  // Load Virtual MR data when repo changes or branches are fetched
  useEffect(() => {
    if (currentRepo) {
      const allBranches = branches ? [...(branches.local || []), ...(branches.remote || [])] : [];
      useVirtualMrStore
        .getState()
        .loadRepoData(currentRepo.id, currentRepo.local_path, allBranches, baseBranch || undefined);
    } else {
      useVirtualMrStore.getState().resetRepoData();
    }
  }, [currentRepo?.id, currentRepo?.local_path, Boolean(branches)]);

  const fileManagerName = getOsFileManagerName();

  const { sidebarWidth, isResizing, startResizing, resetSidebarWidth } = useSidebarResizing();

  const handleSelectConflictFile = (filePath: string) => {
    if (!diffPayload) return;
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    const file = diffPayload.files.find((f) => {
      const fNorm = f.path.replace(/\\/g, '/').toLowerCase();
      return (
        f.path === filePath ||
        fNorm === normalized ||
        fNorm.endsWith(normalized) ||
        normalized.endsWith(fNorm)
      );
    });
    if (file) {
      selectFile(file);
    }
  };

  // Global Keyboard Shortcuts (Like GitKraken / Sublime Merge / Fork)
  const {} = useWorkspaceShortcuts({
    setIsPreferencesOpen,
    setIsCloneModalOpen,
    currentRepo,
    selectNextConflictFile,
    selectNextFile,
    selectPrevFile,
    runSync,
    setIsPullFromOpen,
    setIsMergeFromOpen,
    setIsRebaseFromOpen,
    setViewMode,
    refreshDiff,
    selectedFile,
    showToast,
    fileManagerName,
    remoteUrl,
    compareBranch,
    setTargetFileForUrl,
    setIsRemoteUrlFromOpen,
    toggleInlineBlame,
    showInlineBlame,
  });

  return {
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
  };
}
