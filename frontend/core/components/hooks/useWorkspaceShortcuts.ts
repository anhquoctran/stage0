import { useEffect } from 'react';
import { isMacOS } from '../../../common/utils/shortcuts';
import {
  buildRemoteFileUrl,
  getAbsoluteFilePath,
  openRepoInExplorer,
  openRepoInTerminal,
  openRepoInVsCode,
  revealInOs,
} from '../../../features/git/utils/fileActions';
import { usePerformanceMonitorStore } from '../../../features/performance/store/usePerformanceMonitorStore';
import type { WorkspaceShortcutsContext } from './WorkspaceShortcutsContext';

export function useWorkspaceShortcuts({
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
}: WorkspaceShortcutsContext) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // macOS routes this accelerator through the native View > Performance menu.
      if (
        !isMacOS() &&
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        !e.altKey &&
        (e.key === 'F12' || e.code === 'F12')
      ) {
        e.preventDefault();
        usePerformanceMonitorStore.getState().toggle();
        return;
      }

      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const isPreferencesShortcut =
        (e.ctrlKey || e.metaKey) &&
        (e.key === ',' || (e.shiftKey && (e.key.toLowerCase() === 't' || e.code === 'KeyT')));
      if (isPreferencesShortcut) {
        e.preventDefault();
        setIsPreferencesOpen(true);
        return;
      }

      const isCloneShortcut =
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'o' || e.code === 'KeyO');
      if (isCloneShortcut) {
        e.preventDefault();
        setIsCloneModalOpen(true);
        return;
      }

      if (!currentRepo) return;

      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        (e.key.toLowerCase() === 'c' || e.code === 'KeyC')
      ) {
        e.preventDefault();
        selectNextConflictFile();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        selectNextFile();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        selectPrevFile();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'f' || e.code === 'KeyF')
      ) {
        e.preventDefault();
        runSync('fetch');
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'p' || e.code === 'KeyP')
      ) {
        e.preventDefault();
        runSync('pull');
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.altKey &&
        (e.key.toLowerCase() === 'p' || e.code === 'KeyP')
      ) {
        e.preventDefault();
        setIsPullFromOpen(true);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'm' || e.code === 'KeyM')
      ) {
        e.preventDefault();
        runSync('merge');
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.altKey &&
        (e.key.toLowerCase() === 'm' || e.code === 'KeyM')
      ) {
        e.preventDefault();
        setIsMergeFromOpen(true);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'r' || e.code === 'KeyR')
      ) {
        e.preventDefault();
        runSync('rebase');
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.altKey &&
        (e.key.toLowerCase() === 'r' || e.code === 'KeyR')
      ) {
        e.preventDefault();
        setIsRebaseFromOpen(true);
      } else if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setViewMode('split');
      } else if (e.key === 'u' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setViewMode('unified');
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === 'r'
      ) {
        e.preventDefault();
        refreshDiff();
      } else if (e.shiftKey && e.altKey && (e.key.toLowerCase() === 'r' || e.code === 'KeyR')) {
        // Shift+Alt+R: Open current file in OS File Explorer
        if (currentRepo && selectedFile) {
          e.preventDefault();
          revealInOs(currentRepo.local_path, selectedFile.path)
            .then(() => showToast(`Revealed file in ${fileManagerName}`))
            .catch((err) => showToast(`Failed to open ${fileManagerName}: ${err}`));
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'c' || e.code === 'KeyC')
      ) {
        // Ctrl+Shift+C: Copy relative path
        if (selectedFile) {
          e.preventDefault();
          navigator.clipboard.writeText(selectedFile.path);
          showToast(`Copied relative path: ${selectedFile.path}`);
        }
      } else if (e.shiftKey && e.altKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC')) {
        // Shift+Alt+C: Copy absolute path
        if (currentRepo && selectedFile) {
          e.preventDefault();
          const abs = getAbsoluteFilePath(currentRepo.local_path, selectedFile.path);
          navigator.clipboard.writeText(abs);
          showToast('Copied absolute path to clipboard');
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'u' || e.code === 'KeyU')
      ) {
        // Ctrl+Shift+U: Copy remote file URL
        if (selectedFile) {
          e.preventDefault();
          const effectiveRemote =
            remoteUrl || (currentRepo ? `https://github.com/${currentRepo.name}` : '');
          if (effectiveRemote) {
            const ref = compareBranch || 'main';
            const url = buildRemoteFileUrl(effectiveRemote, ref, selectedFile.path);
            navigator.clipboard.writeText(url);
            showToast(`Copied remote file URL (${ref})`);
          } else {
            showToast('No remote URL configured');
          }
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.altKey &&
        (e.key.toLowerCase() === 'u' || e.code === 'KeyU')
      ) {
        // Ctrl+Alt+U: Copy remote file URL from...
        if (selectedFile) {
          e.preventDefault();
          setTargetFileForUrl(selectedFile);
          setIsRemoteUrlFromOpen(true);
        }
      } else if (e.altKey && e.shiftKey && (e.key.toLowerCase() === 'b' || e.code === 'KeyB')) {
        // Alt+Shift+B: Toggle inline git blame
        e.preventDefault();
        toggleInlineBlame();
        showToast(showInlineBlame ? 'Disabled inline git blame' : 'Enabled inline git blame');
      } else if (e.altKey && e.shiftKey && (e.key.toLowerCase() === 't' || e.code === 'KeyT')) {
        // Alt+Shift+T: Open repository in default terminal
        if (currentRepo) {
          e.preventDefault();
          openRepoInTerminal(currentRepo.local_path)
            .then(() => showToast('Opened repository in terminal'))
            .catch((err) => showToast(`Failed to open terminal: ${err}`));
        }
      } else if (e.altKey && e.shiftKey && (e.key.toLowerCase() === 'v' || e.code === 'KeyV')) {
        // Alt+Shift+V: Open repository in VS Code
        if (currentRepo) {
          e.preventDefault();
          openRepoInVsCode(currentRepo.local_path)
            .then(() => showToast('Opened repository in VS Code'))
            .catch((err) => showToast(`Failed to open VS Code: ${err}`));
        }
      } else if (e.altKey && e.shiftKey && (e.key.toLowerCase() === 'e' || e.code === 'KeyE')) {
        // Alt+Shift+E: Open repository in OS File Explorer / Finder / File Manager
        if (currentRepo) {
          e.preventDefault();
          openRepoInExplorer(currentRepo.local_path)
            .then(() => showToast(`Opened repository in ${fileManagerName}`))
            .catch((err) => showToast(`Failed to open ${fileManagerName}: ${err}`));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentRepo,
    selectNextFile,
    selectPrevFile,
    setViewMode,
    refreshDiff,
    setIsPreferencesOpen,
    setIsCloneModalOpen,
    runSync,
    setIsPullFromOpen,
    setIsMergeFromOpen,
    setIsRebaseFromOpen,
    selectedFile,
    toggleInlineBlame,
    showInlineBlame,
    showToast,
    setTargetFileForUrl,
    setIsRemoteUrlFromOpen,
  ]);

  return {};
}
