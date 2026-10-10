import React, { useEffect, useState } from 'react';
import { FolderGit2 } from '../../../common/components/icons/FolderGit2';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { ShieldCheck } from '../../../common/components/icons/ShieldCheck';
import { AlertTriangle } from '../../../common/components/icons/AlertTriangle';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { Info } from '../../../common/components/icons/Info';
import { Columns2 } from '../../../common/components/icons/Columns2';
import { Rows2 } from '../../../common/components/icons/Rows2';
import { Keyboard } from '../../../common/components/icons/Keyboard';
import { Box } from '../../../common/components/icons/Box';
import { Check } from '../../../common/components/icons/Check';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { FileText } from '../../../common/components/icons/FileText';
import { DownloadCloud } from '../../../common/components/icons/DownloadCloud';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { Sparkles } from '../../../common/components/icons/Sparkles';
import { Bell } from '../../../common/components/icons/Bell';
import { HeartPulse } from '../../../common/components/icons/HeartPulse';
import { useGitStore } from '../../../features/git/store/useGitStore';
import { usePreferencesStore } from '../../../features/preferences/store/usePreferencesStore';
import { useUpdateStore } from '../../../features/updates/store/useUpdateStore';
import { useNotificationStore } from '../../../features/notifications/store/useNotificationStore';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import { usePerformanceMonitorStore } from '../../../features/performance/store/usePerformanceMonitorStore';
import { getPerformanceMetrics } from '../../../features/performance/services/performanceService';
import { type PerformanceMetrics } from '../../../features/performance/types/PerformanceMetrics';

function formatMemory(bytes: number): string {
  const mebibytes = bytes / (1024 * 1024);
  return mebibytes >= 1024
    ? `${(mebibytes / 1024).toFixed(1)} GB`
    : `${Math.round(mebibytes)} MB`;
}

function formatDetailedMemory(bytes: number): string {
  const mebibytes = bytes / (1024 * 1024);
  return mebibytes >= 1024
    ? `${(mebibytes / 1024).toFixed(2)} GB (${Math.round(mebibytes)} MB)`
    : `${mebibytes.toFixed(1)} MB`;
}

export const StatusBar: React.FC = () => {
  const {
    currentRepo,
    branches,
    diffPayload,
    diffError,
    conflictCheckError,
    conflictReport,
    selectedFile,
    viewMode,
    setViewMode,
    activeSandboxType,
    isSyncing,
    syncStatus,
    isDiffLoading,
  } = useGitStore();
  const hasActiveVirtualMr = useVirtualMrStore((state) => {
    const activeSession = state.sessions.find((session) => session.id === state.activeSessionId);
    return Boolean(
      currentRepo &&
      state.currentRepoId === currentRepo.id &&
      !state.isDraftActive &&
      activeSession?.repoId === currentRepo.id
    );
  });
  const { openPreferences } = usePreferencesStore();
  const { unreadCount, isHistoryDrawerOpen, toggleHistoryDrawer } = useNotificationStore();
  const isPerformanceMonitorEnabled = usePerformanceMonitorStore((state) => state.isEnabled);
  const {
    status: updateStatus,
    updatePayload,
    downloadProgress,
    downloadedText,
  } = useUpdateStore();

  const totalFiles = diffPayload?.files.length || 0;
  const currentFileIndex = selectedFile && diffPayload
    ? diffPayload.files.findIndex((f) => f.path === selectedFile.path) + 1
    : 0;

  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [performanceMetricsUnavailable, setPerformanceMetricsUnavailable] = useState(false);

  useEffect(() => {
    if (!isPerformanceMonitorEnabled) {
      setPerformanceMetrics(null);
      setPerformanceMetricsUnavailable(false);
      return;
    }

    let disposed = false;
    let timer: number | undefined;
    const refreshMetrics = async () => {
      try {
        const metrics = await getPerformanceMetrics();
        if (!disposed) {
          setPerformanceMetrics(metrics);
          setPerformanceMetricsUnavailable(false);
        }
      } catch {
        if (!disposed) setPerformanceMetricsUnavailable(true);
      } finally {
        if (!disposed) timer = window.setTimeout(refreshMetrics, 5000);
      }
    };

    void refreshMetrics();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isPerformanceMonitorEnabled]);

  return (
    <footer className="h-7 bg-mantle border-t border-surface0/80 px-3 flex items-center justify-between text-[11px] text-subtext1 shrink-0 select-none z-10">
      {/* Left: Repository info & Active branch & Sync & Updates */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {currentRepo ? (
          <>
            <div
              className="flex items-center gap-1.5 text-subtext1 hover:text-text transition-colors truncate cursor-default"
              title={currentRepo.local_path}
            >
              <FolderGit2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-text truncate">{currentRepo.name}</span>
            </div>

            {branches?.current && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface0/50 border border-surface1/50 text-text font-mono text-[11px] shrink-0">
                <GitBranch className="w-3 h-3 text-blue shrink-0" />
                <span className="truncate max-w-[200px]">{branches.current}</span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-subtext0">
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>No repository open</span>
          </div>
        )}

        {syncStatus && (
          <div
            className="flex items-center gap-1.5 pl-1.5 text-[10px] text-subtext0 min-w-0 max-w-[30vw] truncate"
            title={syncStatus}
          >
            <div className="h-3 w-px bg-surface1 shrink-0 mr-1" />
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 text-blue animate-spin shrink-0" />
            ) : (
              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
            )}
            <span className="truncate">{syncStatus}</span>
          </div>
        )}

        {/* Background Update Activity Indicator */}
        {updateStatus === 'checking' && (
          <button
            type="button"
            onClick={() => openPreferences('updates')}
            className="h-5 px-2 rounded-md bg-[#cba6f7]/10 hover:bg-[#cba6f7]/20 border border-[#cba6f7]/30 text-[#cba6f7] flex items-center gap-1.5 transition-colors cursor-pointer text-[10px] shadow-xs shrink-0 animate-in fade-in duration-200"
            title="Stage0 is checking for software updates in the background. Click to open Updates preferences."
          >
            <RefreshCw className="w-2.5 h-2.5 text-[#cba6f7] animate-spin shrink-0" />
            <span>Checking updates...</span>
          </button>
        )}

        {(updateStatus === 'downloading' || updateStatus === 'cancelling') && (
          <button
            type="button"
            onClick={() => openPreferences('updates')}
            className="h-5 px-2 rounded-md bg-[#cba6f7]/15 hover:bg-[#cba6f7]/25 border border-[#cba6f7]/40 text-[#cba6f7] flex items-center gap-1.5 transition-colors cursor-pointer text-[10px] shadow-xs shrink-0 animate-in fade-in duration-200"
            title={`${updateStatus === 'cancelling' ? 'Cancelling' : 'Downloading'} Stage0 update (${downloadProgress == null ? 'progress unavailable' : `${downloadProgress}%`} - ${downloadedText}). Click to view progress.`}
          >
            <DownloadCloud className="w-3 h-3 text-[#cba6f7] animate-bounce shrink-0" />
            <span>
              {updateStatus === 'cancelling' ? 'Cancelling update…' : (
                <>Downloading update: <strong className="font-mono text-text font-bold">{downloadProgress == null ? '…' : `${downloadProgress}%`}</strong></>
              )}
            </span>
          </button>
        )}

        {updateStatus === 'ready' && (
          <button
            type="button"
            onClick={() => openPreferences('updates')}
            className="h-5 px-2.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 flex items-center gap-1.5 transition-colors cursor-pointer text-[10px] font-semibold shadow-xs shrink-0 animate-in fade-in duration-200"
            title={`Stage0 v${updatePayload?.version || ''} is ready. Click to open the operating-system installer.`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Update Ready • Install</span>
          </button>
        )}

        {updateStatus === 'available' && (
          <button
            type="button"
            onClick={() => openPreferences('updates')}
            className="h-5 px-2 rounded-md bg-[#cba6f7]/15 hover:bg-[#cba6f7]/25 border border-[#cba6f7]/40 text-[#cba6f7] flex items-center gap-1.5 transition-colors cursor-pointer text-[10px] shadow-xs shrink-0 animate-in fade-in duration-200"
            title={`Stage0 v${updatePayload?.version || ''} is available. Click to review.`}
          >
            <Sparkles className="w-3 h-3 text-[#cba6f7] shrink-0" />
            <span>v{updatePayload?.version} Available</span>
          </button>
        )}
      </div>

      {/* Right: Engine, Merge Status, File Counter, View Mode & Shortcuts */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {currentRepo && (
          <>
            {/* Sandbox Engine Picker */}
            <button
              type="button"
              onClick={() => openPreferences('ai-sandbox')}
              className="h-5.5 px-2 rounded-md bg-surface0/70 hover:bg-surface1 border border-surface1 hover:border-surface2 text-subtext0 hover:text-text flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Configure Sandbox Engine in Preferences"
            >
              <Box className="w-3 h-3 text-subtext0" />
              <span className="font-normal text-subtext0">Sandbox:</span>
              <span className="font-medium text-text">
                {activeSandboxType === 'in_memory'
                  ? 'In-Memory'
                  : activeSandboxType === 'local_worktree'
                  ? 'Worktree'
                  : 'Docker'}
              </span>
            </button>

            {/* Comparison status only applies while a Virtual MR is open. */}
            {hasActiveVirtualMr && (
              <>
                {diffError ? (
                  <div
                    className="h-5.5 px-2 rounded-md bg-red/10 border border-red/25 text-red flex items-center gap-1.5 font-medium shadow-xs"
                    title={diffError}
                  >
                    <AlertTriangle className="w-3 h-3 text-red shrink-0" />
                    <span>Compare Failed</span>
                  </div>
                ) : isDiffLoading ? (
                  <div className="h-5.5 px-2 rounded-md bg-surface0/60 border border-surface1/60 text-subtext0 flex items-center gap-1.5 font-medium shadow-xs">
                    <Loader2 className="w-3 h-3 animate-spin text-blue shrink-0" />
                    <span>Comparing...</span>
                  </div>
                ) : conflictCheckError ? (
                  <div
                    className="h-5.5 px-2 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center gap-1.5 font-medium shadow-xs"
                    title={conflictCheckError}
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>Merge Check Unavailable</span>
                  </div>
                ) : diffPayload && diffPayload.files.length === 0 ? (
                  <div className="h-5.5 px-2 rounded-md bg-surface0/50 border border-surface1/50 text-subtext1 flex items-center gap-1.5 font-medium shadow-xs">
                    <Info className="w-3 h-3 text-subtext0 shrink-0" />
                    <span>No Changes</span>
                  </div>
                ) : conflictReport?.has_conflicts ? (
                  <div className="h-5.5 px-2 rounded-md bg-red/10 border border-red/25 text-red flex items-center gap-1.5 font-medium shadow-xs">
                    <AlertTriangle className="w-3 h-3 text-red shrink-0" />
                    <span>Conflicts Detected</span>
                  </div>
                ) : conflictReport ? (
                  <div className="h-5.5 px-2 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center gap-1.5 font-medium shadow-xs">
                    <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>Clean Merge</span>
                  </div>
                ) : null}
              </>
            )}

            {/* File Review Progress Badge */}
            {totalFiles > 0 && (
              <div
                className="h-5.5 px-2 rounded-md bg-surface0/50 border border-surface1/60 text-subtext0 flex items-center gap-1.5 text-[11px] shadow-xs"
                title={selectedFile ? `Active file: ${selectedFile.path}` : `${totalFiles} total files`}
              >
                <FileText className="w-3 h-3 text-subtext0 shrink-0" />
                <span className="flex items-center gap-1">
                  <span>File</span>
                  <span className="font-mono font-semibold text-text">
                    {currentFileIndex > 0 ? currentFileIndex : '–'}
                  </span>
                  <span className="text-subtext0/60 font-light">of</span>
                  <span className="font-mono font-semibold text-text">{totalFiles}</span>
                </span>
              </div>
            )}

            <div className="h-3.5 w-px bg-surface1/80 mx-0.5" />
          </>
        )}

        {hasActiveVirtualMr && (
          <>
            {/* View Mode Switcher */}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'split' ? 'unified' : 'split')}
              className="h-5.5 px-2 rounded-md bg-surface0/40 hover:bg-surface1/70 border border-surface1/40 hover:border-surface2 text-subtext1 hover:text-text flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title={`Click to switch to ${viewMode === 'split' ? 'Unified' : 'Split'} view`}
            >
              {viewMode === 'split' ? (
                <Columns2 className="w-3 h-3 text-blue shrink-0" />
              ) : (
                <Rows2 className="w-3 h-3 text-blue shrink-0" />
              )}
              <span className="capitalize">{viewMode} View</span>
            </button>

            {/* Keyboard Shortcuts Hint */}
            <div className="hidden xl:flex items-center gap-1.5 pl-1.5 text-[10px] text-subtext0/80">
              <div className="h-3 w-px bg-surface1/80 mr-1" />
              <Keyboard className="w-3 h-3 text-subtext0/60 shrink-0" />
              <span>
                <kbd className="font-mono bg-surface0/60 px-1 py-0.2 rounded border border-surface1/40 text-subtext1">↑/↓</kbd> Files
              </span>
              <span className="text-surface2">•</span>
              <span>
                <kbd className="font-mono bg-surface0/60 px-1 py-0.2 rounded border border-surface1/40 text-subtext1">S/U</kbd> View
              </span>
            </div>
          </>
        )}

        {isPerformanceMonitorEnabled && (
          <div
            className="group relative flex h-5.5 items-center gap-2 border-l border-surface1/80 pl-2 text-[10px] text-subtext1 cursor-help focus-visible:outline-none"
            tabIndex={0}
            aria-label="Performance monitor details"
            aria-describedby="performance-monitor-tooltip"
          >
            <HeartPulse className="h-3.5 w-3.5 text-primary shrink-0" />
            {performanceMetricsUnavailable ? (
              <span className="text-subtext0">Perf unavailable</span>
            ) : (
              <>
                <span className="whitespace-nowrap">
                  CPU <strong className="font-mono font-medium text-text">
                    {performanceMetrics?.cpuPercent == null
                      ? performanceMetrics ? 'Measuring…' : '—'
                      : `${performanceMetrics.cpuPercent.toFixed(1)}%`}
                  </strong>
                </span>
                <span className="whitespace-nowrap">
                  MEM <strong className="font-mono font-medium text-text">
                    {performanceMetrics ? formatMemory(performanceMetrics.memoryBytes) : '—'}
                  </strong>
                </span>
              </>
            )}

            <div
              id="performance-monitor-tooltip"
              role="tooltip"
              className="invisible absolute bottom-full right-0 z-50 mb-2 w-72 translate-y-1 rounded-lg border border-surface1 bg-mantle p-3 text-left text-xs text-text opacity-0 shadow-2xl transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Application Performance</span>
                </div>
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-primary">LIVE</span>
              </div>

              {performanceMetricsUnavailable ? (
                <p className="text-subtext1">Could not read process metrics. Stage0 will retry in 5 seconds.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-surface0/70 p-2">
                      <div className="mb-1 text-[10px] text-subtext0">CPU usage</div>
                      <div className="font-mono text-sm font-semibold text-text">
                        {performanceMetrics?.cpuPercent == null
                          ? performanceMetrics ? 'Measuring…' : '—'
                          : `${performanceMetrics.cpuPercent.toFixed(1)}%`}
                      </div>
                    </div>
                    <div className="rounded-md bg-surface0/70 p-2">
                      <div className="mb-1 text-[10px] text-subtext0">Resident memory</div>
                      <div className="font-mono text-sm font-semibold text-text">
                        {performanceMetrics ? formatDetailedMemory(performanceMetrics.memoryBytes) : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-subtext1">
                    <span>Processes tracked</span>
                    <span className="font-mono text-text">{performanceMetrics?.processCount ?? '—'}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-subtext1">
                    <span>Refresh interval</span>
                    <span className="font-mono text-text">5 seconds</span>
                  </div>
                </>
              )}

              <p className="mt-2 border-t border-surface0 pt-2 text-[10px] leading-relaxed text-subtext0">
                CPU and resident memory are aggregated from the Stage0 process and its discovered child processes.
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={toggleHistoryDrawer}
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          aria-expanded={isHistoryDrawerOpen}
          className={`relative grid h-6 w-7 place-items-center rounded transition-colors cursor-pointer ${
            isHistoryDrawerOpen
              ? 'bg-surface1 text-text'
              : 'text-subtext0 hover:bg-surface0 hover:text-text'
          }`}
          title={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        >
          <Bell className="w-3.5 h-3.5" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-0.5 h-1.5 w-1.5 rounded-full bg-brand ring-1 ring-mantle"
            />
          )}
        </button>
      </div>
    </footer>
  );
};
