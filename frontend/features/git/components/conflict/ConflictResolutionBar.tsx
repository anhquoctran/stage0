import { Code2 } from '../../../../common/components/icons/Code2';
import { FileCode } from '../../../../common/components/icons/FileCode';
import { FolderOpen } from '../../../../common/components/icons/FolderOpen';
import { RotateCw } from '../../../../common/components/icons/RotateCw';
import { ShieldAlert } from '../../../../common/components/icons/ShieldAlert';
import { useCommandShortcut } from '../../../../core/hooks/useCommandShortcut';
import type { ConflictResolutionBarProps } from './ConflictResolutionBarProps';

export function ConflictResolutionBar({
  regions,
  activeConflictPreview,
  selectedFile,
  baseBranch,
  compareBranch,
  currentRepo,
  handleOpenInVsCode,
  handleRevealInOs,
  fileManagerName,
  fetchConflictPreview,
  refreshDiff,
  onSwitchToDiff,
}: ConflictResolutionBarProps) {
  const { title: commandTitle } = useCommandShortcut();
  return (
    <div className="bg-gradient-to-r from-red/15 via-red/10 to-red/5 border-b border-red/30 px-4 py-3 shrink-0 rounded-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 bg-red/20 text-red rounded-sm border border-red/40 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5 text-red" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-red">
                Conflict Inspection
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-sm bg-red/25 text-red font-mono font-bold border border-red/40">
                {regions.length > 0
                  ? `${regions.length} conflict block${regions.length > 1 ? 's' : ''}`
                  : activeConflictPreview?.conflict_type || 'Unmerged conflict'}
              </span>
            </div>
            <p className="text-xs text-subtext1 mt-1 font-mono truncate">
              <span className="text-text font-bold">{selectedFile.path}</span>
              <span className="mx-2 text-subtext0">•</span>
              <span>Collision between</span>
              <code className="text-blue font-semibold ml-1 mr-1">{baseBranch}</code>
              <span>and</span>
              <code className="text-blue font-semibold ml-1">{compareBranch}</code>
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {currentRepo && (
            <button
              type="button"
              onClick={handleOpenInVsCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs font-medium transition-colors cursor-pointer"
              title="Open this file directly in Visual Studio Code"
            >
              <Code2 className="w-3.5 h-3.5 text-subtext0" />
              <span>Resolve in VS Code</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRevealInOs}
            className="p-1.5 rounded-sm bg-surface0 hover:bg-surface1 border border-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer"
            title={`Reveal in ${fileManagerName}`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              fetchConflictPreview();
              refreshDiff();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-surface0 hover:bg-surface1 border border-surface1 text-text text-xs font-medium transition-colors cursor-pointer"
            title={commandTitle('refresh_diff', 'Refresh virtual conflict analysis')}
          >
            <RotateCw className="w-3.5 h-3.5 text-subtext0" />
            <span>Re-check</span>
          </button>

          {onSwitchToDiff && (
            <button
              type="button"
              onClick={onSwitchToDiff}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-surface1 hover:bg-surface2 text-text text-xs font-medium transition-colors cursor-pointer"
              title="Switch back to regular Diff View"
            >
              <FileCode className="w-3.5 h-3.5 text-blue" />
              <span>View Diff</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
