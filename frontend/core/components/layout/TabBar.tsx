import React, { useEffect, useMemo } from 'react';
import { Plus } from '../../../common/components/icons/Plus';
import { X } from '../../../common/components/icons/X';
import { List } from '../../../common/components/icons/List';
import { GitPullRequest } from '../../../common/components/icons/GitPullRequest';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { AlertTriangle } from '../../../common/components/icons/AlertTriangle';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import { useGitStore } from '../../../features/git/store/useGitStore';
import { formatShortcutText } from '../../../common/utils/shortcuts';
import { VirtualMrListDialog } from '../../../features/virtual-mr/components/VirtualMrListDialog';

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
    isMrListOpen,
    setIsMrListOpen,
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

  const handleSwitchSession = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    switchSession(sessionId);
    // Sync with GitStore so DiffViewer updates smoothly
    await setBranchComparison(session.baseBranch, session.compareBranch);
  };

  // Handle keyboard shortcuts (must be before any early return to obey React Rules of Hooks)
  useEffect(() => {
    if (!currentRepo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+T: New Virtual MR
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        openNewMrDraft();
      }

      // Ctrl+W: Close Current Virtual MR / Draft
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (isDraftActive) {
          closeNewMrDraft();
        } else if (activeSessionId) {
          closeSession(activeSessionId);
        }
      }

      // Alt+1..9: Switch to tab 1..9
      if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9 && num <= visibleSessions.length) {
          e.preventDefault();
          const target = visibleSessions[num - 1];
          if (target) {
            handleSwitchSession(target.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRepo, visibleSessions, activeSessionId, isDraftActive, openNewMrDraft, closeNewMrDraft, closeSession]);

  if (!currentRepo) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return (
          <span className="text-[10px] px-1.5 py-0.2  bg-emerald-500/20 text-emerald-400 font-mono">
            Resolved
          </span>
        );
      case 'closed':
        return (
          <span className="text-[10px] px-1.5 py-0.2  bg-surface2 text-subtext0 font-mono">
            Closed
          </span>
        );
      default:
        return (
          <span className="text-[10px] px-1.5 py-0.2  bg-brand/20 text-brand font-mono font-medium">
            Open
          </span>
        );
    }
  };

  return (
    <>
      <div className="h-10 border-b border-surface0 bg-crust flex items-center px-2 select-none overflow-x-auto no-scrollbar gap-1 text-xs relative z-30">
        <button
          type="button"
          onClick={() => setIsMrListOpen(true)}
          className={`flex h-8 shrink-0 items-center gap-1.5 border-t border-x px-2.5 transition-colors ${
            isMrListOpen
              ? 'bg-mantle border-surface1 text-text'
              : 'border-transparent text-subtext0 hover:bg-surface0/50 hover:text-text'
          }`}
          title="Browse saved merge requests for this repository"
        >
          <List className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">MRs</span>
          <span className="font-mono text-[10px]">{sessions.length}</span>
        </button>

        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
        {/* Existing Session Tabs */}
        {visibleSessions.map((session) => {
          const isActive = session.id === activeSessionId && !isDraftActive;
          const hasConflict = conflictReport?.has_conflicts && isActive;
          const conflictCount = conflictReport?.conflicted_files.length || 0;

          return (
            <div
              key={session.id}
              onClick={() => handleSwitchSession(session.id)}
              className={`group relative h-8 px-2.5 border-t border-x flex items-center gap-2 cursor-pointer transition-colors shrink-0 max-w-[260px] ${
                isActive
                  ? 'bg-mantle border-surface1 text-text font-medium shadow-xs'
                  : 'bg-crust/50 border-transparent text-subtext0 hover:text-text hover:bg-surface0/40'
              }`}
            >
              {/* Virtual MR PR Icon */}
              <GitPullRequest
                className={`w-3.5 h-3.5 shrink-0 ${
                  isActive ? 'text-brand' : 'text-subtext0'
                }`}
              />

              {/* Clean Title / Branch summary */}
              <span
                className={`truncate text-xs ${isActive ? 'font-medium text-text' : 'text-subtext0'}`}
                title={session.title || `${session.compareBranch} → ${session.baseBranch}`}
              >
                {session.title || `${session.compareBranch} → ${session.baseBranch}`}
              </span>

              {/* Status Badge */}
              {getStatusBadge(session.status)}

              {/* Conflict indicator for active session */}
              {isActive && (
                <div className="flex items-center shrink-0">
                  {isDiffLoading ? (
                    <Loader2 className="w-3 h-3 text-subtext0 animate-spin" />
                  ) : hasConflict ? (
                    <span
                      className="flex items-center gap-0.5 text-[10px] text-amber-400 font-mono"
                      title={`${conflictCount} merge conflicts detected`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      <span>{conflictCount}</span>
                    </span>
                  ) : (
                    <span title="Clean merge prediction">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    </span>
                  )}
                </div>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(session.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5  hover:bg-surface1 text-subtext0 hover:text-text transition-opacity ml-1 cursor-pointer shrink-0"
                title={formatShortcutText('Close tab. This MR remains saved in this repository. (Ctrl+W)')}
              >
                <X className="w-3 h-3" />
              </button>

              {/* Active bottom highlight bar */}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
              )}
            </div>
          );
        })}

        {visibleSessions.length === 0 && !draftMr && (
          <span className="px-2 text-[11px] italic text-subtext0">No open MR tabs</span>
        )}

        {/* Draft Creation Tab (GitHub / GitLab style) */}
        {draftMr && (
          <div
            onClick={() => activateDraftMr()}
            className={`group relative h-8 px-2.5 border-t border-x flex items-center gap-2 cursor-pointer transition-colors shrink-0 max-w-[260px] ${
              isDraftActive
                ? 'bg-mantle border-surface1 text-text font-medium shadow-xs'
                : 'bg-crust/50 border-transparent text-subtext0 hover:text-text hover:bg-surface0/40'
            }`}
          >
            <GitPullRequest
              className={`w-3.5 h-3.5 shrink-0 ${
                isDraftActive ? 'text-brand' : 'text-subtext0'
              }`}
            />
            <span
              className={`truncate text-xs ${isDraftActive ? 'font-medium text-text' : 'text-subtext0'}`}
              title={draftMr.title || `${draftMr.compareBranch} → ${draftMr.baseBranch}`}
            >
              {draftMr.title || 'New Virtual MR'}
            </span>
            <span className="text-[10px] px-1.5 py-0.2  bg-brand/20 text-brand font-mono font-medium">
              Draft
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeNewMrDraft();
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5  hover:bg-surface1 text-subtext0 hover:text-text transition-opacity ml-1 cursor-pointer shrink-0"
              title={formatShortcutText('Close Draft (Ctrl+W)')}
            >
              <X className="w-3 h-3" />
            </button>
            {isDraftActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
            )}
          </div>
        )}

        {/* New Virtual MR Tab Button (+ icon right next to last tab) */}
        <button
          type="button"
          onClick={() => openNewMrDraft()}
          className="w-7 h-7 flex items-center justify-center  bg-surface1 hover:bg-surface2 text-white transition-colors shrink-0 cursor-pointer shadow-xs"
          title={formatShortcutText('New Virtual MR (Ctrl+T)')}
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>
      </div>
      <VirtualMrListDialog />
    </>
  );
};
