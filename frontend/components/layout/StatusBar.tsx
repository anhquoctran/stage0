import {
  FolderGit2,
  GitBranch,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Info,
  Columns2,
  Rows2,
  Keyboard,
  Box,
  Check,
  RefreshCw,
} from '@/components/common/icons';
import { useGitStore } from '../../store/useGitStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';

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
    activeSandboxType,
    isSyncing,
    syncStatus,
    isDiffLoading,
  } = useGitStore();
  const { setIsPreferencesOpen } = usePreferencesStore();

  const totalFiles = diffPayload?.files.length || 0;
  const currentFileIndex = selectedFile && diffPayload
    ? diffPayload.files.findIndex((f) => f.path === selectedFile.path) + 1
    : 0;

  return (
    <footer className="h-7 bg-mantle border-t border-surface0 pl-3 pr-3.5 flex items-center justify-between text-[11px] text-subtext1 shrink-0 select-none z-10">
      {/* Left: Repo & Active Branch */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {currentRepo ? (
          <>
            <div className="flex items-center gap-1.5 hover:text-text transition-colors" title={currentRepo.local_path}>
              <FolderGit2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold text-text">{currentRepo.name}</span>
            </div>

            {branches?.current && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-surface0">
                <GitBranch className="w-3 h-3 text-blue shrink-0" />
                <span className="font-mono text-text">{branches.current}</span>
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
            className="flex items-center gap-1.5 pl-2 border-l border-surface0 min-w-0 max-w-[34vw] text-[10px] text-subtext0"
            title={syncStatus}
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 text-blue animate-spin shrink-0" />
            ) : (
              <Check className="w-3 h-3 text-green shrink-0" />
            )}
            <span className="truncate">{syncStatus}</span>
          </div>
        )}
      </div>

      {/* Center: Sandbox Engine & Conflict Status */}
      {currentRepo && (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPreferencesOpen(true)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface0 hover:bg-surface1 border border-surface1 hover:border-surface2 text-text transition-colors cursor-pointer"
            title="Configure Sandbox Engine in Preferences"
          >
            <Box className="w-3 h-3 text-subtext0" />
            <span className="font-medium">
              Sandbox: {activeSandboxType === 'in_memory' ? 'In-Memory' : activeSandboxType === 'local_worktree' ? 'Worktree' : 'Docker'}
            </span>
          </button>

          {diffError ? (
            <div className="flex items-center gap-1.5 text-red font-medium px-2 py-0.5 bg-red/10 border border-red/20" title={diffError}>
              <AlertTriangle className="w-3 h-3 text-red" />
              <span>Compare Failed</span>
            </div>
          ) : isDiffLoading ? (
            <div className="flex items-center gap-1.5 text-subtext0 font-medium px-2 py-0.5 bg-surface0/40 border border-surface0">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Comparing</span>
            </div>
          ) : conflictCheckError ? (
            <div className="flex items-center gap-1.5 text-text font-medium px-2 py-0.5 bg-yellow/10 border border-yellow/20" title={conflictCheckError}>
              <AlertTriangle className="w-3 h-3 text-yellow" />
              <span>Merge Check Unavailable</span>
            </div>
          ) : diffPayload && diffPayload.files.length === 0 ? (
            <div className="flex items-center gap-1.5 text-subtext1 font-medium px-2 py-0.5 bg-surface0/50 border border-surface0">
              <Info className="w-3 h-3" />
              <span>No Changes</span>
            </div>
          ) : conflictReport?.has_conflicts ? (
            <div className="flex items-center gap-1.5 text-red font-medium px-2 py-0.5 rounded bg-red/10 border border-red/20">
              <AlertTriangle className="w-3 h-3 text-red" />
              <span>Conflicts Detected</span>
            </div>
          ) : conflictReport ? (
            <div className="flex items-center gap-1.5 text-green font-medium px-2 py-0.5 rounded bg-green/10 border border-green/20">
              <ShieldCheck className="w-3 h-3 text-green" />
              <span>Clean Merge</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Right: File Review Index, View Mode & Key Hints */}
      <div className="flex items-center gap-3 shrink-0">
        {totalFiles > 0 && (
          <div className="flex items-center gap-1 text-text">
            <span>File</span>
            <span className="font-mono font-semibold text-text">
              {currentFileIndex > 0 ? `${currentFileIndex} of ${totalFiles}` : `${totalFiles} total`}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 pl-2 border-l border-surface0 text-subtext1">
          {viewMode === 'split' ? (
            <Columns2 className="w-3 h-3 text-blue" />
          ) : (
            <Rows2 className="w-3 h-3 text-blue" />
          )}
          <span className="capitalize">{viewMode} View</span>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-surface0 text-[10px] text-subtext0">
          <Keyboard className="w-3 h-3" />
          <span>[↑/↓] Files • [S/U] View</span>
        </div>
      </div>
    </footer>
  );
};
