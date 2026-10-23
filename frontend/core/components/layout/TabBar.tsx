import React, { useMemo } from 'react';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import { useGitStore } from '../../../features/git/store/useGitStore';
import { useTabBarShortcuts } from './tab-bar/useTabBarShortcuts';
import { TabBarMrListButton } from './tab-bar/TabBarMrListButton';
import { TabBarSessionItem } from './tab-bar/TabBarSessionItem';
import { TabBarDraftItem } from './tab-bar/TabBarDraftItem';
import { TabBarNewButton } from './tab-bar/TabBarNewButton';

export const TabBar: React.FC = () => {
  const {
    currentRepo,
    conflictReport,
    isDiffLoading,
    setBranchComparison,
  } = useGitStore();

  const {
    sessions,
    activeSessionId,
    closedSessionTabIds,
    draftMr,
    isDraftActive,
    openMrListView,
    switchSession,
    closeSession,
    openNewMrDraft,
    closeNewMrDraft,
    activateDraftMr,
  } = useVirtualMrStore();

  const visibleSessions = useMemo(
    () => sessions.filter((session) => !closedSessionTabIds.includes(session.id)),
    [sessions, closedSessionTabIds]
  );
  const isMrListActive = !activeSessionId && !isDraftActive;

  const handleSwitchSession = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    switchSession(sessionId);
    // Sync with GitStore so DiffViewer updates smoothly
    await setBranchComparison(session.baseBranch, session.compareBranch);
  };

  // Keyboard shortcuts (called before any early return to obey Rules of Hooks)
  useTabBarShortcuts({
    enabled: Boolean(currentRepo),
    visibleSessions,
    activeSessionId,
    isDraftActive,
    onOpenNewDraft: openNewMrDraft,
    onCloseNewDraft: closeNewMrDraft,
    onCloseSession: closeSession,
    onSwitchSession: handleSwitchSession,
  });

  if (!currentRepo) return null;

  return (
    <div className="h-10 border-b border-surface0 bg-crust flex items-center px-2 select-none overflow-x-auto no-scrollbar gap-1 text-xs relative z-30 rounded-sm">
      <TabBarMrListButton
        isActive={isMrListActive}
        sessionCount={sessions.length}
        onClick={() => openMrListView()}
      />

      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
        {/* Existing Session Tabs */}
        {visibleSessions.map((session) => {
          const isActive = session.id === activeSessionId && !isDraftActive;
          const hasConflict = Boolean(conflictReport?.has_conflicts && isActive);
          const conflictCount = conflictReport?.conflicted_files.length || 0;

          return (
            <TabBarSessionItem
              key={session.id}
              session={session}
              isActive={isActive}
              isDiffLoading={isDiffLoading}
              hasConflict={hasConflict}
              conflictCount={conflictCount}
              onSelect={() => handleSwitchSession(session.id)}
              onClose={() => closeSession(session.id)}
            />
          );
        })}

        {visibleSessions.length === 0 && !draftMr && (
          <span className="px-2 text-[11px] italic text-subtext0">No open MR tabs</span>
        )}

        {/* Draft Creation Tab (GitHub / GitLab style) */}
        {draftMr && (
          <TabBarDraftItem
            draftMr={draftMr}
            isActive={isDraftActive}
            onActivate={() => activateDraftMr()}
            onClose={() => closeNewMrDraft()}
          />
        )}

        {/* New Virtual MR Tab Button (+ icon right next to last tab) */}
        <TabBarNewButton onClick={() => openNewMrDraft()} />
      </div>
    </div>
  );
};
