import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from '../../../common/components/icons/ChevronDown';
import { ChevronUp } from '../../../common/components/icons/ChevronUp';
import { FileWarning } from '../../../common/components/icons/FileWarning';
import { ShieldAlert } from '../../../common/components/icons/ShieldAlert';
import { VsCode } from '../../../common/components/icons/VsCode';
import { Terminal } from '../../../common/components/icons/Terminal';
import { FolderOpen } from '../../../common/components/icons/FolderOpen';
import { Copy } from '../../../common/components/icons/Copy';
import { Check } from '../../../common/components/icons/Check';
import { RotateCw } from '../../../common/components/icons/RotateCw';
import { AlertTriangle } from '../../../common/components/icons/AlertTriangle';
import { useGitStore } from '../store/useGitStore';
import { openRepoInTerminal, openRepoInVsCode, openFileInEditor, revealInOs, getOsFileManagerName } from '../utils/fileActions';
import { useCommandShortcut } from '../../../core/hooks/useCommandShortcut';
import type { ConflictBannerProps } from '../types/ConflictBannerProps';

export const ConflictBanner: React.FC<ConflictBannerProps> = ({
  conflictReport,
  onSelectConflictFile,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const { title: commandTitle } = useCommandShortcut();
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
    showToast(t('git.conflicts.copiedGitCommand'));
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  const handleOpenFileInVsCode = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentRepo) return;
    try {
      await openFileInEditor(currentRepo.local_path, filePath);
      showToast(t('git.conflicts.openedFileInVsCode', { path: filePath }), 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, 'error');
    }
  };

  const handleRevealInOs = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentRepo) return;
    try {
      await revealInOs(currentRepo.local_path, filePath);
      showToast(t('git.conflicts.revealedFileIn', { name: fileManagerName }));
    } catch (err) {
      showToast(t('git.conflicts.failedToRevealFile', { error: String(err) }));
    }
  };

  return (
    <div className="bg-gradient-to-r from-red/15 via-red/10 to-red/5 border-b border-red/30 px-4 py-3 text-text select-none shadow-md z-10 animate-in fade-in duration-150 rounded-sm">
      {/* Top Summary Bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 bg-red/20 text-red rounded-sm border border-red/40 shadow-xs shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5 text-red" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-red">
                {t('git.conflicts.detected')}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (conflictReport.conflicted_files.length > 0) {
                    onSelectConflictFile?.(conflictReport.conflicted_files[0]);
                  }
                }}
                className="text-[11px] px-2 py-0.5 rounded-sm bg-red/25 hover:bg-red/35 text-red font-mono font-bold border border-red/40 conflict-pulse cursor-pointer transition-colors"
                title={commandTitle('next_conflict', t('git.conflicts.jumpToFirstFile'))}
              >
                {conflictedCount > 0
                  ? t('git.conflicts.fileCount', { count: conflictedCount })
                  : t('git.conflicts.inMemoryConflict')}
              </button>
              <span className="text-[11px] text-subtext1">
                {t('git.conflicts.betweenBranches', { compare, base })}
              </span>
            </div>
            <p className="text-xs text-subtext1 mt-1 leading-relaxed">
              <strong>{t('git.conflicts.notice')}</strong> {t('git.conflicts.virtualSandboxNotice')}
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
                    showToast(t('git.conflicts.openedRepositoryInVsCode'), 'success');
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    showToast(msg, 'error');
                  }
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs font-medium transition-colors cursor-pointer"
                title={commandTitle('open_vscode', t('git.conflicts.openRepositoryInVsCodeTitle'))}
              >
                <VsCode className="w-3.5 h-3.5 text-[#007acc]" />
                <span>{t('git.conflicts.openInVsCode')}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await openRepoInTerminal(currentRepo.local_path);
                    showToast(t('git.conflicts.openedRepositoryInTerminal'));
                  } catch (err) {
                    showToast(t('git.conflicts.failedToOpenTerminal', { error: String(err) }));
                  }
                }}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs font-medium transition-colors cursor-pointer"
                title={commandTitle('open_terminal', t('git.conflicts.openDefaultTerminalTitle'))}
              >
                <Terminal className="w-3.5 h-3.5 text-subtext0" />
                <span>{t('git.conflicts.terminal')}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={refreshDiff}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs font-medium transition-colors cursor-pointer"
            title={commandTitle('refresh_diff', t('git.conflicts.refreshVirtualDiffTitle'))}
          >
            <RotateCw className="w-3.5 h-3.5 text-subtext0" />
            <span>{t('git.conflicts.recheck')}</span>
          </button>

          {conflictedCount > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-sm bg-red/20 hover:bg-red/30 border border-red/40 text-red transition-colors shadow-xs cursor-pointer"
            >
              <span>{isExpanded ? t('git.conflicts.hideDetails') : t('git.conflicts.viewConflicts')}</span>
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
          <div className="bg-mantle/80 border border-surface0 rounded-sm p-2.5 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="font-semibold text-text flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red" />
                {t('git.conflicts.localResolutionTitle')}
              </span>
              <p className="text-[11px] text-subtext1">
                {t('git.conflicts.localResolutionHelp')}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleCopyCommand(rebaseCmd)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-surface0 hover:bg-surface1 border border-surface1 text-xs font-mono text-text transition-colors cursor-pointer"
                title={t('git.conflicts.copyCommandTitle', { command: rebaseCmd })}
              >
                {copiedCmd === rebaseCmd ? (
                  <Check className="w-3 h-3 text-green" />
                ) : (
                  <Copy className="w-3 h-3 text-subtext0" />
                )}
                <span>{t('git.conflicts.copyRebaseCommand')}</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopyCommand(mergeCmd)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-surface0 hover:bg-surface1 border border-surface1 text-xs font-mono text-text transition-colors cursor-pointer"
                title={t('git.conflicts.copyCommandTitle', { command: mergeCmd })}
              >
                {copiedCmd === mergeCmd ? (
                  <Check className="w-3 h-3 text-green" />
                ) : (
                  <Copy className="w-3 h-3 text-subtext0" />
                )}
                <span>{t('git.conflicts.copyMergeCommand')}</span>
              </button>
            </div>
          </div>

          {/* Conflicted Files List */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-red mb-2 flex items-center justify-between">
              <span>{t('git.conflicts.conflictedFiles', { count: conflictedCount })}</span>
              <span className="text-[10px] text-subtext0 lowercase font-normal">
                {t('git.conflicts.inspectFileHint')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pe-1">
              {conflictReport.conflicted_files.map((filePath) => {
                const detail = conflictReport.details?.find((d) => d.path === filePath);
                const conflictType = detail?.conflict_type || 'content';
                const markersCount = detail?.conflict_markers_count ?? 0;

                return (
                  <div
                    key={filePath}
                    onClick={() => onSelectConflictFile?.(filePath)}
                    className="group flex items-center justify-between gap-2 p-2 rounded-sm bg-mantle border border-surface0 hover:border-red/60 hover:bg-surface0 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileWarning className="w-4 h-4 text-red shrink-0" />
                      <div className="min-w-0 font-mono text-xs">
                        <div className="font-semibold text-text truncate">
                          {filePath}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-subtext0 mt-0.5">
                          <span className="uppercase px-1.5 py-0.2 rounded-sm bg-surface1 text-subtext1 font-bold">
                            {conflictType}
                          </span>
                          {markersCount > 0 ? (
                            <span className="text-red font-semibold">
                              {t('git.conflicts.markersOnDisk', { count: markersCount })}
                            </span>
                          ) : (
                            <span className="text-subtext0">
                              {t('git.conflicts.predictedConflict')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => handleOpenFileInVsCode(filePath, e)}
                        className="p-1 rounded-sm hover:bg-surface1 text-subtext0 hover:text-text transition-colors"
                        title={t('git.conflicts.openFileInVsCodeTitle')}
                      >
                        <VsCode className="w-3.5 h-3.5 text-[#007acc]" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleRevealInOs(filePath, e)}
                        className="p-1 rounded-sm hover:bg-surface1 text-subtext0 hover:text-text transition-colors"
                        title={t('git.conflicts.revealIn', { name: fileManagerName })}
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
