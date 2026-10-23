import { useEffect } from 'react';
import type { WorkspaceShortcutsContext } from './WorkspaceShortcutsContext';

// Only workspace-specific navigation/aliases live here. Menu accelerators have
// one owner: useApplicationMenu (custom UI) or the native macOS menu.
export function useWorkspaceShortcuts({
  currentRepo,
  setIsPreferencesOpen,
  selectNextConflictFile,
  selectNextFile,
  selectPrevFile,
  setViewMode,
}: WorkspaceShortcutsContext) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.isComposing ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)
      )
        return;
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        !e.altKey &&
        (e.key.toLowerCase() === 't' || e.code === 'KeyT')
      ) {
        e.preventDefault();
        setIsPreferencesOpen(true);
        return;
      }
      if (!currentRepo) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        selectNextConflictFile();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === 'ArrowDown' || e.key === 'j') {
          e.preventDefault();
          selectNextFile();
        } else if (e.key === 'ArrowUp' || e.key === 'k') {
          e.preventDefault();
          selectPrevFile();
        } else if (e.key === 's') setViewMode('split');
        else if (e.key === 'u') setViewMode('unified');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentRepo,
    setIsPreferencesOpen,
    selectNextConflictFile,
    selectNextFile,
    selectPrevFile,
    setViewMode,
  ]);
  return {};
}
