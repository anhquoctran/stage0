import { AlertCircle } from '../../../../common/components/icons/AlertCircle';
import { Check } from '../../../../common/components/icons/Check';
import { FolderOpen } from '../../../../common/components/icons/FolderOpen';
import { Plus } from '../../../../common/components/icons/Plus';
import { RefreshCw } from '../../../../common/components/icons/RefreshCw';
import type { CustomGitBinaryFormProps } from './CustomGitBinaryFormProps';

export function CustomGitBinaryForm({
  showAddCustom,
  setShowAddCustom,
  setCustomError,
  customPath,
  setCustomPath,
  navigator,
  handleBrowseCustom,
  handleValidateAndAddCustom,
  isValidatingCustom,
  customError,
}: CustomGitBinaryFormProps) {
  return (
    <div className="pt-2 border-t border-surface0/60">
      {!showAddCustom ? (
        <button
          type="button"
          onClick={() => setShowAddCustom(true)}
          className="flex items-center gap-1.5 text-xs text-brand hover:underline font-medium cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Custom Git Binary Path...</span>
        </button>
      ) : (
        <div className="p-4 bg-surface0/40 border border-surface1 space-y-3 animate-in fade-in duration-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text">Specify Custom Git Executable</span>
            <button
              type="button"
              onClick={() => {
                setShowAddCustom(false);
                setCustomError(null);
              }}
              className="text-[11px] text-subtext0 hover:text-text cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder={
                typeof navigator !== 'undefined' && navigator.userAgent.includes('Win')
                  ? 'C:\\Path\\To\\git.exe'
                  : '/usr/local/bin/git'
              }
              className="flex-1 px-3 py-1.5 text-xs font-mono bg-base border border-surface1 text-text focus:outline-none focus:border-brand placeholder:text-subtext0/50"
            />
            <button
              type="button"
              onClick={handleBrowseCustom}
              className="flex items-center gap-1 px-3 py-1.5 border border-surface1 hover:bg-surface1 text-xs text-subtext0 hover:text-text transition-colors cursor-pointer shrink-0"
              title="Browse for executable file"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Browse...</span>
            </button>
            <button
              type="button"
              onClick={handleValidateAndAddCustom}
              disabled={isValidatingCustom || !customPath.trim()}
              className="flex items-center gap-1 px-3.5 py-1.5 bg-brand text-on-accent text-xs font-semibold hover:bg-brand/90 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            >
              {isValidatingCustom ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Test &amp; Select</span>
            </button>
          </div>

          {customError && (
            <div className="p-2.5 bg-red/10 border border-red/30 text-red text-xs flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{customError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
