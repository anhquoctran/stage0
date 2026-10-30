import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from '../../../../common/components/icons/AlertTriangle';
import { GitMerge } from '../../../../common/components/icons/GitMerge';
import { ArrowDown } from '../../../../common/components/icons/ArrowDown';
import { VsCode } from '../../../../common/components/icons/VsCode';
import { RotateCw } from '../../../../common/components/icons/RotateCw';
import { openFileInEditor } from '../../utils/fileActions';
import { useCommandShortcut } from '../../../../core/hooks/useCommandShortcut';
import type { ChangedFile } from '../../types/ChangedFile';
import type { ConflictReport } from '../../types/ConflictReport';
import type { ConflictFilePreview } from '../../types/ConflictFilePreview';
import type { RepoInfo } from '../../types/RepoInfo';

export const DiffConflictNotificationBar: React.FC<{
  selectedFile: ChangedFile;
  conflictReport: ConflictReport | null;
  activeConflictPreview: ConflictFilePreview | null;
  currentRepo: RepoInfo | null;
  onSwitchToConflicts: () => void;
  onScrollToFirstConflict: () => void;
  onRefreshDiff: () => void;
  onShowToast: (msg: string, level?: 'info' | 'success' | 'error') => void;
}> = ({
  selectedFile,
  conflictReport,
  activeConflictPreview,
  currentRepo,
  onSwitchToConflicts,
  onScrollToFirstConflict,
  onRefreshDiff,
  onShowToast,
}) => {
  const { t } = useTranslation();
  const detail = conflictReport?.details?.find((d) => d.path === selectedFile.path);
  const { title: commandTitle } = useCommandShortcut();

  return (
    <div className="bg-red/10 border-b border-red/30 px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-text select-none shrink-0 rounded-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1 bg-red/20 text-red border border-red/30 shrink-0 rounded-sm">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-red">
              {t('git.diff.conflict.unmergedInFile')}
            </span>
            {detail?.conflict_type && (
              <span className="text-[10px] uppercase px-1.5 py-[0.2rem] bg-surface1 text-subtext1 font-bold">
                {detail.conflict_type}
              </span>
            )}
            {detail?.conflict_markers_count ? (
              <span className="text-[10px] text-red font-semibold">
                {t('git.diff.conflict.activeMarkers', { count: detail.conflict_markers_count })}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-subtext1 mt-0.5 truncate max-w-2xl">
            {detail?.message ||
              t('git.diff.conflict.virtualSandboxNote')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!selectedFile.is_binary && (
          <>
            <button
              type="button"
              onClick={onSwitchToConflicts}
              className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold transition-colors cursor-pointer text-xs shadow-xs rounded-sm"
              title={t('git.diff.conflict.inspectThreeWayTitle')}
            >
              <GitMerge className="w-3.5 h-3.5 text-white" />
              <span>
                {activeConflictPreview?.conflict_regions.length
                  ? t('git.diff.conflict.threeWayCount', { count: activeConflictPreview.conflict_regions.length })
                  : t('git.diff.conflict.threeWayView')}
              </span>
            </button>

            <button
              type="button"
              onClick={onScrollToFirstConflict}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-white font-semibold transition-colors cursor-pointer text-xs shadow-xs rounded-sm"
              title={t('git.diff.conflict.jumpTitle')}
            >
              <ArrowDown className="w-3.5 h-3.5 text-white" />
              <span>{t('git.diff.conflict.jump')}</span>
            </button>
          </>
        )}

        {currentRepo && (
          <button
            type="button"
            onClick={async () => {
              try {
                await openFileInEditor(currentRepo.local_path, selectedFile.path);
                onShowToast(t('git.diff.conflict.openedInVsCode', { path: selectedFile.path }), 'success');
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                onShowToast(msg, 'error');
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-white font-medium transition-colors cursor-pointer text-xs rounded-sm"
            title={t('git.conflicts.openInVsCodeTitle')}
          >
            <VsCode className="w-3.5 h-3.5 text-[#007acc]" />
            <span>{t('git.conflicts.resolveInVsCode')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onRefreshDiff}
          className="flex items-center gap-1.5 px-2 py-1 bg-surface1 hover:bg-surface2 text-white font-medium transition-colors cursor-pointer text-xs rounded-sm"
          title={commandTitle('refresh_diff', t('git.diff.conflict.refreshTitle'))}
        >
          <RotateCw className="w-3 h-3 text-white" />
          <span>{t('git.diff.conflict.refresh')}</span>
        </button>
      </div>
    </div>
  );
};
