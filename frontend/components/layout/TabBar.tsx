import React, { useEffect } from 'react';
import {
  Plus,
  X,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from '@/components/common/icons';
import { useVirtualMrStore } from '../../store/useVirtualMrStore';
import { useGitStore } from '../../store/useGitStore';
import { formatShortcutText } from '../../utils/shortcuts';

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
    draftMr,
    isDraftActive,
    switchSession,
    closeSession,
    openNewMrDraft,
    closeNewMrDraft,
    activateDraftMr,
  } = useVirtualMrStore();

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
        if (num >= 1 && num <= 9 && num <= sessions.length) {
          e.preventDefault();
          const target = sessions[num - 1];
          if (target) {
            handleSwitchSession(target.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentRepo, sessions, activeSessionId, isDraftActive, openNewMrDraft, closeNewMrDraft, closeSession]);

  if (!currentRepo) return null;

  // When all tabs are closed and no draft is open, render clean minimal bar with Add MR CTA
  if (sessions.length === 0 && !draftMr) {
    return (
      <div className="h-9 border-b border-surface0 bg-crust flex items-center justify-between px-3 select-none text-xs relative z-30">
        <div className="flex items-center gap-2 text-subtext0">
          <GitPullRequest className="w-3.5 h-3.5 text-subtext1" />
          <span className="italic text-[11px]">No active Virtual MR sessions</span>
        </div>
        <button
          type="button"
          onClick={() => openNewMrDraft()}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs cursor-pointer shadow-xs transition-colors"
          title={formatShortcutText('Create new Virtual MR (Ctrl+T)')}
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Virtual MR</span>
          <kbd className="ml-1 px-1 py-0.2 text-[9px] font-mono bg-black/15 text-on-accent border border-black/10">{formatShortcutText('Ctrl+T')}</kbd>
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 font-mono">
            Approved
          </span>
        );
      case 'closed':
        return (
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface2 text-subtext0 font-mono">
            Closed
          </span>
        );
      default:
        return (
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-brand/20 text-brand font-mono font-medium">
            Open
          </span>
        );
    }
  };

  return (
    <div className="h-10 border-b border-surface0 bg-crust flex items-center px-2 select-none overflow-x-auto no-scrollbar gap-1 text-xs relative z-30">
      <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
        {/* Existing Session Tabs */}
        {sessions.map((session) => {
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
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface1 text-subtext0 hover:text-text transition-opacity ml-1 cursor-pointer shrink-0"
                title={formatShortcutText('Close Virtual MR (Ctrl+W)')}
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
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-brand/20 text-brand font-mono font-medium">
              Draft
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeNewMrDraft();
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface1 text-subtext0 hover:text-text transition-opacity ml-1 cursor-pointer shrink-0"
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
          className="w-7 h-7 flex items-center justify-center rounded bg-surface1 hover:bg-surface2 text-white transition-colors shrink-0 cursor-pointer shadow-xs"
          title={formatShortcutText('New Virtual MR (Ctrl+T)')}
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
};
