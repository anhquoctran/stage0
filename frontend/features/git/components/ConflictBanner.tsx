import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileWarning,
  ShieldAlert,
  Code2,
  Terminal,
  FolderOpen,
  Copy,
  Check,
  RotateCw,
  AlertTriangle,
} from '@/common/components/icons';
import { ConflictReport } from '../types/git';
import { useGitStore } from '../store/useGitStore';
import {
  openRepoInTerminal,
  openRepoInVsCode,
  openFileInEditor,
  revealInOs,
  getOsFileManagerName,
} from '../utils/fileActions';
import { formatShortcutText } from '../../../common/utils/shortcuts';

interface ConflictBannerProps {
  conflictReport: ConflictReport | null;
  onSelectConflictFile?: (filePath: string) => void;
}

export const ConflictBanner: React.FC<ConflictBannerProps> = ({
  conflictReport,
  onSelectConflictFile,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const { currentRepo, baseBranch, compareBranch, refreshDiff, showToast } =
    useGitStore();

  if (!conflictReport || !conflictReport.has_conflicts) {
    return null;
  }

  const conflictedCount = conflictReport.conflicted_files.length;
  const fileManagerName = getOsFileManagerName();

  const base = conflictReport.base_branch || baseBranch || 'main';
  const compare = conflictReport.compare_branch || compareBranch || 'feature';

  const rebaseCmd = `git checkout ${compare} && git rebase ${base}`;
  const mergeCmd = `git checkout ${compare} && git merge ${base}`;

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    showToast('Copied git command to clipboard');
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const handleOpenFileInVsCode = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentRepo) return;
    try {
      await openFileInEditor(currentRepo.local_path, filePath);
      showToast(`Opened ${filePath} in VS Code`);
    } catch (err) {
      showToast(`Failed to open in VS Code: ${err}`);
    }
  };

  const handleRevealInOs = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentRepo) return;
    try {
      await revealInOs(currentRepo.local_path, filePath);
      showToast(`Revealed file in ${fileManagerName}`);
    } catch (err) {
      showToast(`Failed to reveal file: ${err}`);
    }
  };

  return (
    <div className="bg-gradient-to-r from-red/15 via-red/10 to-red/5 border-b border-red/30 px-4 py-3 text-text select-none shadow-md z-10 animate-in fade-in duration-150">
      {/* Top Summary Bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 bg-red/20 text-red rounded-lg border border-red/40 shadow-xs shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5 text-red" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-red">
                Merge Conflicts Detected
              </span>
              <button
                type="button"
                onClick={() => {
                  if (conflictReport.conflicted_files.length > 0) {
                    onSelectConflictFile?.(conflictReport.conflicted_files[0]);
                  }
                }}
                className="text-[11px] px-2 py-0.5 rounded-full bg-red/25 hover:bg-red/35 text-red font-mono font-bold border border-red/40 conflict-pulse cursor-pointer transition-colors"
                title={formatShortcutText('Click to jump directly to first conflicted file (Alt+C)')}
              >
                {conflictedCount > 0 ? `${conflictedCount} file(s) in conflict` : 'In-memory conflict'}
              </button>
              <span className="text-[11px] text-subtext1">
                between <code className="font-mono text-text bg-surface0 px-1 py-0.5 rounded border border-surface1">{compare}</code> and <code className="font-mono text-text bg-surface0 px-1 py-0.5 rounded border border-surface1">{base}</code>
              </span>
            </div>
            <p className="text-xs text-subtext1 mt-1 leading-relaxed">
              <strong>Notice:</strong> Stage0 is an in-memory Virtual MR Sandbox and does not resolve conflicts in-app.
              Please resolve these conflicts in your external Git tool or IDE before continuing with the virtual PR/MR.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {currentRepo && (
            <>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await openRepoInVsCode(currentRepo.local_path);
                    showToast('Opened repository in VS Code');
                  } catch (err) {
                    showToast(`Failed to open VS Code: ${err}`);
                  }
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs font-medium transition-colors cursor-pointer"
                title={formatShortcutText('Open repository in Visual Studio Code (Alt+Shift+V)')}
              >
                <Code2 className="w-3.5 h-3.5 text-subtext0" />
                <span>Open in VS Code</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await openRepoInTerminal(currentRepo.local_path);
                    showToast('Opened repository in Terminal');
                  } catch (err) {
                    showToast(`Failed to open Terminal: ${err}`);
                  }
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs font-medium transition-colors cursor-pointer"
                title={formatShortcutText('Open repository in Default Terminal (Alt+Shift+T)')}
              >
                <Terminal className="w-3.5 h-3.5 text-subtext0" />
                <span>Terminal</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={refreshDiff}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs font-medium transition-colors cursor-pointer"
            title={formatShortcutText('Refresh virtual diff and re-check conflicts (Ctrl+R)')}
          >
            <RotateCw className="w-3.5 h-3.5 text-subtext0" />
            <span>Re-check</span>
          </button>

          {conflictedCount > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-red/20 hover:bg-red/30 border border-red/40 text-red transition-colors shadow-xs cursor-pointer"
            >
              <span>{isExpanded ? 'Hide Details' : 'View Conflicts'}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-red" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-red" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded Conflict Inspection Card */}
      {isExpanded && conflictedCount > 0 && (
        <div className="mt-3 pt-3 border-t border-red/20 space-y-3 animate-in fade-in duration-150">
          {/* External Resolution Guide & Quick Commands */}
          <div className="bg-mantle/80 border border-surface0 rounded-lg p-2.5 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="font-semibold text-text flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red" />
                How to resolve in your local Git workspace:
              </span>
              <p className="text-[11px] text-subtext1">
                Run either rebase or merge locally, resolve all conflicting blocks in your editor, then commit. Stage0 will auto-refresh.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleCopyCommand(rebaseCmd)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface0 hover:bg-surface1 border border-surface1 text-xs font-mono text-text transition-colors cursor-pointer"
                title={`Copy command: ${rebaseCmd}`}
              >
                {copiedCmd === rebaseCmd ? (
                  <Check className="w-3 h-3 text-green" />
                ) : (
                  <Copy className="w-3 h-3 text-subtext0" />
                )}
                <span>Copy Rebase Command</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyCommand(mergeCmd)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface0 hover:bg-surface1 border border-surface1 text-xs font-mono text-text transition-colors cursor-pointer"
                title={`Copy command: ${mergeCmd}`}
              >
                {copiedCmd === mergeCmd ? (
                  <Check className="w-3 h-3 text-green" />
                ) : (
                  <Copy className="w-3 h-3 text-subtext0" />
                )}
                <span>Copy Merge Command</span>
              </button>
            </div>
          </div>

          {/* Conflicted Files List */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-red mb-2 flex items-center justify-between">
              <span>Conflicted Files ({conflictedCount}):</span>
              <span className="text-[10px] text-subtext0 lowercase font-normal">
                Click any file to inspect in Diff Viewer
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {conflictReport.conflicted_files.map((filePath) => {
                const detail = conflictReport.details?.find((d) => d.path === filePath);
                const conflictType = detail?.conflict_type || 'content';
                const markersCount = detail?.conflict_markers_count ?? 0;

                return (
                  <div
                    key={filePath}
                    onClick={() => onSelectConflictFile?.(filePath)}
                    className="group flex items-center justify-between gap-2 p-2 rounded-lg bg-mantle border border-surface0 hover:border-red/60 hover:bg-surface0 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileWarning className="w-4 h-4 text-red shrink-0" />
                      <div className="min-w-0 font-mono text-xs">
                        <div className="font-semibold text-text truncate">
                          {filePath}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-subtext0 mt-0.5">
                          <span className="uppercase px-1.5 py-0.2 rounded bg-surface1 text-subtext1 font-bold">
                            {conflictType}
                          </span>
                          {markersCount > 0 ? (
                            <span className="text-red font-semibold">
                              {markersCount} marker(s) on disk
                            </span>
                          ) : (
                            <span className="text-subtext0">
                              predicted conflict
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => handleOpenFileInVsCode(filePath, e)}
                        className="p-1 rounded hover:bg-surface1 text-subtext0 hover:text-text transition-colors"
                        title="Open file in Visual Studio Code to resolve"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRevealInOs(filePath, e)}
                        className="p-1 rounded hover:bg-surface1 text-subtext0 hover:text-text transition-colors"
                        title={`Reveal in ${fileManagerName}`}
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
