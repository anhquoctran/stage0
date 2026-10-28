import { Folder } from '../../../../common/components/icons/Folder';
import { FolderOpen } from '../../../../common/components/icons/FolderOpen';
import type { CloneDestinationSectionProps } from './CloneDestinationSectionProps';

export function CloneDestinationSection({
  isCloning,
  destinationPath,
  parentDir,
  handleBrowseFolder,
}: CloneDestinationSectionProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-text mb-1.5">
        Destination Directory <span className="text-red">*</span>
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Folder className="w-4 h-4 text-subtext0 absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            disabled={isCloning}
            readOnly
            aria-label="Destination Directory"
            value={destinationPath || parentDir}
            placeholder="Home directory + repository name"
            className="w-full ps-9 pe-3 py-2 bg-surface0 border border-surface1 focus:border-blue focus:ring-1 focus:ring-blue text-xs text-text placeholder-subtext0 font-mono outline-hidden transition-all disabled:opacity-60 rounded-sm"
          />
        </div>
        <button
          type="button"
          disabled={isCloning}
          onClick={handleBrowseFolder}
          title="Choose a parent folder for the repository"
          className="px-3.5 py-2 bg-surface1 hover:bg-surface2 text-text border border-surface2 text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 rounded-sm"
        >
          <FolderOpen className="w-3.5 h-3.5 text-blue" />
          <span>Browse...</span>
        </button>
      </div>
      <p className="mt-1 text-[10px] text-subtext0">
        Full clone destination: home directory + repository name. Browse changes the parent folder.
      </p>
    </div>
  );
}
