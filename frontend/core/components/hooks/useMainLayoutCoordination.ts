import { useEffect } from 'react';
import { useGitStore } from '../../../features/git/store/useGitStore';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import { useSidebarResizing } from './useSidebarResizing';

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
    setViewMode,
    openRepoDialog,
    baseBranch,
    branches,
    toastMessage,
    toastLevel,
  } = useGitStore();

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
    loadRepoData,
    resetRepoData,
  } = useVirtualMrStore();

  // Load Virtual MR data when repo changes or branches are fetched
  useEffect(() => {
    if (currentRepo) {
      const allBranches = branches ? [...(branches.local || []), ...(branches.remote || [])] : [];
      void loadRepoData(currentRepo.id, currentRepo.local_path, allBranches, baseBranch || undefined);
    } else {
      resetRepoData();
    }
  }, [currentRepo?.id, currentRepo?.local_path, Boolean(branches), loadRepoData, resetRepoData]);

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
