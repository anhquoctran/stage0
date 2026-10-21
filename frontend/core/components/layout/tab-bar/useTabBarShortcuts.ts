import { useEffect } from 'react';
import type { VirtualMrSession } from '../../../../features/virtual-mr/types/VirtualMrSession';

export function useTabBarShortcuts({
  enabled,
  visibleSessions,
  activeSessionId,
  isDraftActive,
  onOpenNewDraft,
  onCloseNewDraft,
  onCloseSession,
  onSwitchSession,
}: {
  enabled: boolean;
  visibleSessions: VirtualMrSession[];
  activeSessionId: string | null;
  isDraftActive: boolean;
  onOpenNewDraft: () => void;
  onCloseNewDraft: () => void;
  onCloseSession: (id: string) => void;
  onSwitchSession: (id: string) => void;
}) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+T: New Virtual MR
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        onOpenNewDraft();
      }

      // Ctrl+W: Close Current Virtual MR / Draft
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (isDraftActive) {
          onCloseNewDraft();
        } else if (activeSessionId) {
          onCloseSession(activeSessionId);
        }
      }

      // Alt+1..9: Switch to tab 1..9
      if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9 && num <= visibleSessions.length) {
          e.preventDefault();
          const target = visibleSessions[num - 1];
          if (target) {
            onSwitchSession(target.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    visibleSessions,
    activeSessionId,
    isDraftActive,
    onOpenNewDraft,
    onCloseNewDraft,
    onCloseSession,
    onSwitchSession,
  ]);
}

