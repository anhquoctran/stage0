import React from 'react';
import { AlertTriangle } from '../../../../common/components/icons/AlertTriangle';
import { GitMerge } from '../../../../common/components/icons/GitMerge';
import { ArrowDown } from '../../../../common/components/icons/ArrowDown';
import { Code2 } from '../../../../common/components/icons/Code2';
import { RotateCw } from '../../../../common/components/icons/RotateCw';
import { openFileInEditor } from '../../utils/fileActions';
import { formatShortcutText } from '../../../../common/utils/shortcuts';
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
  onShowToast: (msg: string) => void;
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
  const detail = conflictReport?.details?.find((d) => d.path === selectedFile.path);

  return (
    <div className="bg-red/10 border-b border-red/30 px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-text select-none shrink-0 rounded-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-1 bg-red/20 text-red border border-red/30 shrink-0 rounded-sm">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-red">
              Unmerged Conflict in this file
            </span>
            {detail?.conflict_type && (
              <span className="text-[10px] uppercase px-1.5 py-0.2 bg-surface1 text-subtext1 font-bold">
                {detail.conflict_type}
              </span>
            )}
            {detail?.conflict_markers_count ? (
              <span className="text-[10px] text-red font-semibold">
                ({detail.conflict_markers_count} active marker(s) on disk)
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-subtext1 mt-0.5 truncate max-w-2xl">
            {detail?.message ||
              'Stage0 is a virtual sandbox and does not modify your repository. Please resolve this conflict in your external editor.'}
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
              title="Inspect 3-way collision blocks side-by-side"
            >
              <GitMerge className="w-3.5 h-3.5 text-white" />
              <span>
                3-Way Conflict View {activeConflictPreview?.conflict_regions.length ? `(${activeConflictPreview.conflict_regions.length})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={onScrollToFirstConflict}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-white font-semibold transition-colors cursor-pointer text-xs shadow-xs rounded-sm"
              title="Scroll directly to conflict marker or first conflict change in this file"
            >
              <ArrowDown className="w-3.5 h-3.5 text-white" />
              <span>Jump to Conflict</span>
            </button>
          </>
        )}

        {currentRepo && (
          <button
            type="button"
            onClick={async () => {
              try {
                await openFileInEditor(currentRepo.local_path, selectedFile.path);
                onShowToast(`Opened ${selectedFile.path} in VS Code`);
              } catch (err) {
                onShowToast(`Failed to open in VS Code: ${err}`);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-surface1 hover:bg-surface2 text-white font-medium transition-colors cursor-pointer text-xs rounded-sm"
            title="Open this file directly in Visual Studio Code to resolve conflict"
          >
            <Code2 className="w-3.5 h-3.5 text-white" />
            <span>Resolve in VS Code</span>
          </button>
        )}

        <button
          type="button"
          onClick={onRefreshDiff}
          className="flex items-center gap-1.5 px-2 py-1 bg-surface1 hover:bg-surface2 text-white font-medium transition-colors cursor-pointer text-xs rounded-sm"
          title={formatShortcutText('Re-check diff after resolving conflict in external tool (Ctrl+R)')}
        >
          <RotateCw className="w-3 h-3 text-white" />
          <span>Refresh Diff</span>
        </button>
      </div>
    </div>
  );
};

