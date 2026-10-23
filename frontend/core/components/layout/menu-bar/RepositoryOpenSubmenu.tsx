import { ChevronRight } from '../../../../common/components/icons/ChevronRight';
import { Code2 } from '../../../../common/components/icons/Code2';
import { ExternalLink } from '../../../../common/components/icons/ExternalLink';
import { Folder } from '../../../../common/components/icons/Folder';
import { Terminal } from '../../../../common/components/icons/Terminal';
import {
  openRepoInExplorer,
  openRepoInTerminal,
  openRepoInVsCode,
} from '../../../../features/git/utils/fileActions';
import type { RepositoryOpenSubmenuProps } from './RepositoryOpenSubmenuProps';

export function RepositoryOpenSubmenu({
  setActiveSubmenu,
  currentRepo,
  activeSubmenu,
  onClose,
  showToast,
  shortcut,
  fileManagerName,
}: RepositoryOpenSubmenuProps) {
  return (
    <div
      className="relative"
      onMouseEnter={() => setActiveSubmenu('open')}
      onMouseLeave={() => setActiveSubmenu(null)}
    >
      <button
        type="button"
        disabled={!currentRepo}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors disabled:opacity-40 disabled:hover:bg-transparent group cursor-pointer rounded-sm"
      >
        <div className="flex items-center gap-2">
          <ExternalLink className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
          <span>Open in</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
      </button>

      {activeSubmenu === 'open' && currentRepo && (
        <div className="absolute left-full top-0 ml-0.5 w-60 shadow-2xl bg-mantle border border-surface0 py-1.5 z-50 text-xs rounded-sm">
          <button
            type="button"
            onClick={async () => {
              onClose();
              try {
                await openRepoInTerminal(currentRepo.local_path);
                showToast('Opened repository in terminal');
              } catch (err) {
                showToast(`Failed to open terminal: ${err}`);
              }
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Terminal</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+Shift+T')}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              onClose();
              try {
                await openRepoInVsCode(currentRepo.local_path);
                showToast('Opened repository in VS Code');
              } catch (err) {
                showToast(`Failed to open VS Code: ${err}`);
              }
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>Visual Studio Code</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+Shift+V')}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              onClose();
              try {
                await openRepoInExplorer(currentRepo.local_path);
                showToast(`Opened repository in ${fileManagerName}`);
              } catch (err) {
                showToast(`Failed to open ${fileManagerName}: ${err}`);
              }
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-surface1 text-text text-left transition-colors group cursor-pointer rounded-sm"
          >
            <div className="flex items-center gap-2">
              <Folder className="w-3.5 h-3.5 text-subtext0 group-hover:text-text transition-colors" />
              <span>{fileManagerName}</span>
            </div>
            <span className="text-[10px] text-subtext0 font-mono">{shortcut('Alt+Shift+E')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
